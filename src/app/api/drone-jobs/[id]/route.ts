import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAnalysisPipeline } from "@/lib/pipeline";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await prisma.droneJob.findUnique({
    where: { id },
    include: {
      survey: {
        include: {
          property: true,
          images: { orderBy: { sortOrder: "asc" } },
        },
      },
      operator: { select: { id: true, name: true, email: true } },
    },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Operators can only see posted jobs or their own
  const canView =
    session.user.role === "admin" ||
    job.status === "posted" ||
    job.operatorId === session.user.id;

  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(job);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "drone" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const job = await prisma.droneJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { action } = body;

  // ── Accept a posted job ────────────────────────────────────────────────────
  if (action === "accept") {
    if (job.status !== "posted") {
      return NextResponse.json({ error: "Job is no longer available" }, { status: 400 });
    }
    const updated = await prisma.droneJob.update({
      where: { id },
      data: {
        status: "accepted",
        operatorId: session.user.id,
        acceptedAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  }

  // ── Mark images uploaded / complete ───────────────────────────────────────
  if (action === "complete") {
    if (job.operatorId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (job.status !== "accepted" && job.status !== "in_progress") {
      return NextResponse.json({ error: "Job cannot be completed in its current state" }, { status: 400 });
    }

    // Check at least 1 image has been uploaded
    const imageCount = await prisma.image.count({ where: { surveyId: job.surveyId } });
    if (imageCount < 1) {
      return NextResponse.json({ error: "Upload at least one image before completing" }, { status: 400 });
    }

    const updated = await prisma.droneJob.update({
      where: { id },
      data: { status: "images_uploaded", completedAt: new Date() },
    });

    // Automatically kick off the AI analysis pipeline.
    // waitUntil keeps the Vercel function alive until the pipeline finishes,
    // even though we've already returned the response to the operator.
    waitUntil(
      runAnalysisPipeline(job.surveyId).catch((err) =>
        console.error(`[drone-jobs] Auto-analysis failed for survey ${job.surveyId}:`, err)
      )
    );

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
