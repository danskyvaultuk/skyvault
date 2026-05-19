import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedReadUrl, generatePdfKey, uploadBuffer } from "@/lib/r2";
import { analyzeRoof } from "@/lib/claude";
import { renderReportPDF } from "@/lib/pdf";
import { distributeLeads } from "@/lib/leads";
import { notifyCustomerReportReady } from "@/lib/resend";
import sharp from "sharp";

// Claude Vision limit is 5MB per image.
// We resize to max 1568px and convert to JPEG so every image comfortably fits.
// The original full-res file stays untouched in S3.
async function resizeForClaude(buffer: ArrayBuffer): Promise<{ data: Buffer; mimeType: string }> {
  const resized = await sharp(Buffer.from(buffer))
    .resize(1568, 1568, {
      fit: "inside",        // preserve aspect ratio, never upscale
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 }) // convert to JPEG — consistent, efficient
    .toBuffer();

  return { data: resized, mimeType: "image/jpeg" };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: surveyId } = await params;

  // ── Step 1: Load survey and validate it's ready ──────────────────────────────
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      property: true,
    },
  });

  if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 });

  // Only the owner or admin can trigger analysis
  if (survey.customerId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Must be draft or pending (pending = drone operator finished uploading)
  if (survey.status !== "draft" && survey.status !== "pending") {
    return NextResponse.json(
      { error: `Survey is already ${survey.status}` },
      { status: 400 }
    );
  }

  // Enforce at least 1 image
  if (survey.images.length < 1) {
    return NextResponse.json(
      { error: "Upload at least 1 image before analysing" },
      { status: 400 }
    );
  }

  // ── Step 2: Mark as analysing (prevents duplicate requests) ─────────────────
  await prisma.survey.update({
    where: { id: surveyId },
    data: { status: "analysing" },
  });

  try {
    // ── Step 3: Fetch images from S3, resize, and convert to base64 ───────────
    // Claude Vision has a 5MB limit per image.
    // We resize to max 1568px and JPEG-compress in memory before sending.
    // The original full-res file stays untouched in S3.
    console.log(`[analyse] Fetching ${survey.images.length} images from S3…`);

    const imageData = await Promise.all(
      survey.images.map(async (img) => {
        const readUrl = await getPresignedReadUrl(img.s3Key);
        const response = await fetch(readUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${img.s3Key}`);
        const rawBuffer = await response.arrayBuffer();

        // Resize to fit Claude's 5MB limit — original stays in S3 unchanged
        const { data, mimeType } = await resizeForClaude(rawBuffer);
        const sizeKB = Math.round(data.length / 1024);
        console.log(`[analyse] Resized ${img.originalFilename ?? img.s3Key} → ${sizeKB}KB`);

        return {
          base64: data.toString("base64"),
          mimeType,
        };
      })
    );

    // ── Step 4: Call Claude Vision ─────────────────────────────────────────────
    console.log("[analyse] Sending images to Claude…");
    const analysis = await analyzeRoof(
      imageData.map((d) => d.base64),
      imageData.map((d) => d.mimeType),
      survey.notes ?? undefined
    );
    console.log(`[analyse] Got score: ${analysis.condition_score}/10`);

    // ── Step 5: Generate PDF report ────────────────────────────────────────────
    console.log("[analyse] Generating PDF…");
    const pdfBuffer = await renderReportPDF(
      analysis,
      survey.property.address,
      survey.property.postcode,
      imageData.map((d) => d.base64)
    );

    // ── Step 6: Upload PDF to S3 ───────────────────────────────────────────────
    const pdfKey = generatePdfKey(surveyId);
    await uploadBuffer(pdfKey, pdfBuffer, "application/pdf");
    console.log(`[analyse] PDF uploaded: ${pdfKey}`);

    // ── Step 7: Save Report record to database ─────────────────────────────────
    const report = await prisma.report.create({
      data: {
        surveyId,
        conditionScore: analysis.condition_score,
        defectsJson: analysis.defects,
        estimatedRemainingLife: analysis.estimated_remaining_life_years,
        recommendations: analysis.recommendations,
        confidence: analysis.confidence,
        rawAiResponse: analysis as object,
        pdfS3Key: pdfKey,
        status: "published",
      },
    });

    // ── Step 8: Mark survey as complete ───────────────────────────────────────
    const completedSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data: { status: "complete" },
      include: {
        customer: { select: { email: true, name: true } },
        property: { select: { postcode: true } },
      },
    });

    // ── Step 9: Create Lead + notify matching roofers ─────────────────────────
    try {
      await distributeLeads(surveyId, report.id, completedSurvey.property.postcode);
    } catch (err) {
      // Don't fail the whole pipeline if lead distribution errors
      console.error("[analyse] Lead distribution failed:", err);
    }

    // ── Step 10: Notify customer their report is ready ─────────────────────────
    notifyCustomerReportReady({
      customerEmail: completedSurvey.customer.email,
      customerName: completedSurvey.customer.name ?? "",
      surveyId,
    }).catch((err) => console.error("[analyse] Customer email failed:", err));

    console.log(`[analyse] Complete! reportId: ${report.id}`);
    return NextResponse.json({ reportId: report.id });

  } catch (err) {
    // ── On any error: mark as failed so the customer can retry ────────────────
    console.error("[analyse] Pipeline failed:", err);

    await prisma.survey.update({
      where: { id: surveyId },
      data: { status: "failed" },
    }).catch(() => {}); // don't throw if this also fails

    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
