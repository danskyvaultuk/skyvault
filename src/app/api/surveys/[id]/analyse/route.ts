import { NextResponse } from "next/server";
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

  try {
    const report = await runAnalysisPipeline(surveyId);
    return NextResponse.json({ reportId: report.id });
  } catch {
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
