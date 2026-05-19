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
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  return { data: resized, mimeType: "image/jpeg" };
}

/**
 * Runs the full AI analysis pipeline for a survey.
 *
 * Can be called from:
 *  - POST /api/surveys/[id]/analyse  (customer or admin triggers manually)
 *  - PATCH /api/drone-jobs/[id]      (automatically when operator marks job complete)
 *
 * Assumes the survey is already in "analysing" or "pending" status when called.
 * Sets status → "analysing" at the start, then → "complete" or "failed".
 *
 * Returns the created Report record.
 */
export async function runAnalysisPipeline(surveyId: string) {
  // ── Step 1: Load survey ────────────────────────────────────────────────────
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      property: true,
      customer: { select: { email: true, name: true } },
    },
  });

  if (!survey) throw new Error(`Survey ${surveyId} not found`);
  if (survey.images.length < 1) throw new Error("Survey has no images to analyse");

  // ── Step 2: Mark as analysing ──────────────────────────────────────────────
  await prisma.survey.update({
    where: { id: surveyId },
    data: { status: "analysing" },
  });

  try {
    // ── Step 3: Fetch images from S3, resize, convert to base64 ───────────
    console.log(`[pipeline] Fetching ${survey.images.length} images for survey ${surveyId}…`);

    const imageData = await Promise.all(
      survey.images.map(async (img) => {
        const readUrl = await getPresignedReadUrl(img.s3Key);
        const response = await fetch(readUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${img.s3Key}`);
        const rawBuffer = await response.arrayBuffer();

        const { data, mimeType } = await resizeForClaude(rawBuffer);
        const sizeKB = Math.round(data.length / 1024);
        console.log(`[pipeline] Resized ${img.originalFilename ?? img.s3Key} → ${sizeKB}KB`);

        return { base64: data.toString("base64"), mimeType };
      })
    );

    // ── Step 4: Call Claude Vision ─────────────────────────────────────────
    console.log("[pipeline] Sending images to Claude…");
    const analysis = await analyzeRoof(
      imageData.map((d) => d.base64),
      imageData.map((d) => d.mimeType),
      survey.notes ?? undefined
    );
    console.log(`[pipeline] Got score: ${analysis.condition_score}/10`);

    // ── Step 5: Generate PDF report ────────────────────────────────────────
    console.log("[pipeline] Generating PDF…");
    const pdfBuffer = await renderReportPDF(
      analysis,
      survey.property.address,
      survey.property.postcode,
      imageData.map((d) => d.base64)
    );

    // ── Step 6: Upload PDF to S3 ───────────────────────────────────────────
    const pdfKey = generatePdfKey(surveyId);
    await uploadBuffer(pdfKey, pdfBuffer, "application/pdf");
    console.log(`[pipeline] PDF uploaded: ${pdfKey}`);

    // ── Step 7: Save Report record ─────────────────────────────────────────
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

    // ── Step 8: Mark survey complete ───────────────────────────────────────
    await prisma.survey.update({
      where: { id: surveyId },
      data: { status: "complete" },
    });

    // ── Step 9: Distribute leads ───────────────────────────────────────────
    try {
      await distributeLeads(surveyId, report.id, survey.property.postcode);
    } catch (err) {
      console.error("[pipeline] Lead distribution failed:", err);
    }

    // ── Step 10: Notify customer ───────────────────────────────────────────
    notifyCustomerReportReady({
      customerEmail: survey.customer.email,
      customerName: survey.customer.name ?? "",
      surveyId,
    }).catch((err) => console.error("[pipeline] Customer email failed:", err));

    console.log(`[pipeline] Complete! reportId: ${report.id}`);
    return report;

  } catch (err) {
    // ── On any error: mark as failed ──────────────────────────────────────
    console.error("[pipeline] Pipeline failed:", err);

    await prisma.survey.update({
      where: { id: surveyId },
      data: { status: "failed" },
    }).catch(() => {});

    throw err; // re-throw so callers know it failed
  }
}
