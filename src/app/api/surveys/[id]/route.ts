import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SurveyStatus, Prisma } from "@prisma/client";
import { RoofContextSchema, sanitizeRoofContext } from "@/lib/roofContext";
import { getPresignedReadUrl } from "@/lib/r2";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      property: true,
      images: { orderBy: { sortOrder: "asc" } },
      report: true,
      droneJob: true,
    },
  });

  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = survey.customerId === session.user.id;
  const isOperator =
    session.user.role === "drone" && survey.droneJob?.operatorId === session.user.id;
  if (!isOwner && !isOperator && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Attach a viewable presigned URL per image — needed for the post-upload
  // tagging grid to render thumbnails, including on a reopened survey where
  // there's no local File object to preview from.
  const imageUrls = await Promise.all(
    survey.images.map((img) => getPresignedReadUrl(img.s3Key, 3600))
  );
  const images = survey.images.map((img, i) => ({ ...img, url: imageUrls[i] }));

  return NextResponse.json({ ...survey, images });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const survey = await prisma.survey.findUnique({ where: { id } });
  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (survey.customerId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  // Allow resetting a failed survey back to draft for retry
  const data: { notes?: string; status?: SurveyStatus; roofContext?: Prisma.InputJsonValue } = {};
  // Allow updating notes freely while the survey is still in draft
  if (body.notes !== undefined && survey.status === "draft") data.notes = body.notes;
  if (body.status === "draft" && survey.status === "failed") data.status = "draft";

  // Opt-in roof Q&A — same draft-only window as notes. Every field is optional;
  // an empty object is valid (customer skipped everything).
  if (body.roofContext !== undefined && survey.status === "draft") {
    const parsed = RoofContextSchema.safeParse(body.roofContext);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    data.roofContext = sanitizeRoofContext(parsed.data);
  }

  const updated = await prisma.survey.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
