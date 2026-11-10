import { prisma } from "@/lib/prisma";
import { generatePdfKey, uploadBuffer } from "@/lib/r2";
import { analyzeRoof } from "@/lib/claude";
import { renderReportPDF } from "@/lib/pdf";
import { distributeLeads } from "@/lib/leads";
import { journeys } from "@/lib/journeys";
import { RoofContextSchema } from "@/lib/roofContext";
import { fetchSurveyPhotos } from "@/lib/surveyImages";

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

    const imageData = await fetchSurveyPhotos(survey.images);

    // ── Step 4: Call Claude Vision ─────────────────────────────────────────
    console.log("[pipeline] Sending images to Claude…");
    // survey.roofContext is untyped JSON from the DB — validate before use so a
    // malformed/legacy value can never reach the prompt builder or crash the pipeline.
    const roofContext = RoofContextSchema.safeParse(survey.roofContext).success
      ? RoofContextSchema.parse(survey.roofContext)
      : null;

    const analysis = await analyzeRoof(
      imageData.map((d) => d.base64),
      imageData.map((d) => d.mimeType),
      survey.notes ?? undefined,
      roofContext
    );
    console.log(`[pipeline] Got score: ${analysis.condition_score}/10`);

    // ── Step 5: Generate PDF report ────────────────────────────────────────
    console.log("[pipeline] Generating PDF…");
    const pdfBuffer = await renderReportPDF(
      analysis,
      survey.property.address,
      survey.property.postcode,
      imageData.map((d) => d.base64),
      survey.notes,
      roofContext
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
        // Held until an admin approves it (BL-061).
        status: "draft",
      },
    });

    // ── Step 8: Mark survey complete ───────────────────────────────────────
    await prisma.survey.update({
      where: { id: surveyId },
      data: { status: "complete" },
    });

    // ── Step 9: Distribute leads (only while the roofer journey is on, BL-058) ─
    if (journeys.rooferEnabled) {
      try {
        await distributeLeads(surveyId, report.id, survey.property.postcode);
      } catch (err) {
        console.error("[pipeline] Lead distribution failed:", err);
      }
    }

    // ── Step 10: No customer email here ────────────────────────────────────
    // The report is held for admin review; the customer is emailed when an
    // admin approves it (ReportReview.approve, BL-061).

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
