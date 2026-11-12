import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAnalysisPipeline } from "@/lib/pipeline";
import { analysisLimitReached } from "@/lib/analysisLimit";
import { reportError } from "@/lib/monitoring";

type SurveyToAnalyse = {
  customerId: string;
  status: string;
  images: unknown[];
  report: { id: string } | null;
};

// The answer for a survey that cannot be analysed as it stands, or null when it can.
function notReady(survey: SurveyToAnalyse, userId: string, role: string): NextResponse | null {
  // Only the owner or admin can trigger analysis
  if (survey.customerId !== userId && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Must be draft or pending (pending = drone operator finished uploading)
  if (survey.status !== "draft" && survey.status !== "pending") {
    return NextResponse.json({ error: `Survey is already ${survey.status}` }, { status: 400 });
  }
  // Enforce at least 1 image
  if (survey.images.length < 1) {
    return NextResponse.json({ error: "Upload at least 1 image before analysing" }, { status: 400 });
  }
  // One report per survey: a second run would pay for a model call and fail at the insert
  if (survey.report) {
    return NextResponse.json({ error: "This survey already has a report" }, { status: 409 });
  }
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: surveyId } = await params;

  // ── Load survey and validate it's ready ────────────────────────────────────
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: { images: true, report: { select: { id: true } } },
  });

  if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 });

  const refusal = notReady(survey, session.user.id, session.user.role);
  if (refusal) return refusal;

  // Counted against the survey's owner, also when an admin calls
  if (await analysisLimitReached(survey.customerId)) {
    return NextResponse.json({ error: "Analysis limit reached. Please try again later." }, { status: 429 });
  }

  // Claim the survey in one conditional update so concurrent calls cannot both run the pipeline
  const claim = await prisma.survey.updateMany({
    where: { id: surveyId, status: { in: ["draft", "pending"] } },
    data: { status: "analysing" },
  });
  if (claim.count === 0) {
    return NextResponse.json({ error: "Survey is already being analysed" }, { status: 400 });
  }

  // Background analysis (BL-023): every report waits for the admin anyway
  // (BL-061), so the customer is answered at once. waitUntil keeps the
  // function alive until the pipeline finishes. The pipeline marks the survey
  // "failed" only for errors inside its own try, so an earlier throw would leave
  // it stuck in "analysing" (BL-071): the handler puts it back to "failed" here,
  // so the customer can retry, and reports the failure.
  waitUntil(
    runAnalysisPipeline(surveyId).then(
      () => undefined,
      async (err) => {
        reportError(err, { what: "analysis-failed", surveyId });
        await prisma.survey
          .updateMany({ where: { id: surveyId, status: "analysing" }, data: { status: "failed" } })
          .catch(() => {});
      }
    )
  );
  return NextResponse.json({ status: "analysing" }, { status: 202 });
}
