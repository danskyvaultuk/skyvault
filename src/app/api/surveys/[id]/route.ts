import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SurveyStatus, Prisma } from "@prisma/client";
import { RoofContextSchema, sanitizeRoofContext } from "@/lib/roofContext";
import { getPresignedReadUrl } from "@/lib/r2";
import { SurveyNotesSchema } from "@/lib/surveyNotes";
import { isStaleAnalysis } from "@/lib/surveyState";
import { reportForViewer } from "@/lib/reportRelease";

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

  // A held report is not shown to the customer until an admin approves it,
  // and admin notes are never shown to a customer (BL-061).
  const report = reportForViewer(survey.report, session.user.role === "admin");

  return NextResponse.json({ ...survey, images, report });
}

type SurveyUpdate = { notes?: string; status?: SurveyStatus; roofContext?: Prisma.InputJsonValue };
type SurveyForUpdate = { status: SurveyStatus; updatedAt: Date };
type PatchBody = { notes?: unknown; status?: unknown; roofContext?: unknown };

// The fields a customer's PATCH may change, or why the request is refused.
function surveyUpdate(body: PatchBody, survey: SurveyForUpdate): { data: SurveyUpdate } | { error: unknown } {
  const data: SurveyUpdate = {};
  const isDraft = survey.status === "draft";

  // Notes must be a string of at most 2,000 characters, whatever the status
  // (BL-066 / SPEC-021 C4); they are saved only while the survey is a draft.
  if (body.notes !== undefined) {
    const notes = SurveyNotesSchema.safeParse(body.notes);
    if (!notes.success) return { error: notes.error.flatten() };
    if (isDraft) data.notes = notes.data;
  }

  // A failed survey, or a stale analysis (BL-066 / SPEC-021 E2), can be reset to draft for a retry.
  if (body.status === "draft" && (survey.status === "failed" || isStaleAnalysis(survey))) data.status = "draft";

  // Opt-in roof Q&A — same draft-only window as notes. Every field is optional;
  // an empty object is valid (customer skipped everything).
  if (body.roofContext !== undefined && isDraft) {
    const parsed = RoofContextSchema.safeParse(body.roofContext);
    if (!parsed.success) return { error: parsed.error.flatten() };
    data.roofContext = sanitizeRoofContext(parsed.data);
  }
  return { data };
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

  const update = surveyUpdate(await req.json(), survey);
  if ("error" in update) return NextResponse.json({ error: update.error }, { status: 400 });
  const data = update.data;

  const updated = await prisma.survey.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
