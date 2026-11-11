import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAnalysisPipeline } from "@/lib/pipeline";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: surveyId } = await params;

  // ── Load survey and validate it's ready ────────────────────────────────────
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: { images: true },
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

  // Background analysis (BL-023): every report waits for the admin anyway
  // (BL-061), so the customer is answered at once. waitUntil keeps the
  // function alive until the pipeline finishes; a failure marks the survey
  // "failed" inside the pipeline, so the customer can retry.
  await prisma.survey.update({ where: { id: surveyId }, data: { status: "analysing" } });
  waitUntil(
    runAnalysisPipeline(surveyId).then(
      () => undefined,
      (err) => console.error(`[analyse] Analysis failed for survey ${surveyId}:`, err)
    )
  );
  return NextResponse.json({ status: "analysing" }, { status: 202 });
}
