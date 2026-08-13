import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PhotoTagSchema, type PhotoTag } from "@/lib/photoTag";

type AuthResult =
  | { ok: true; imageId: string }
  | { ok: false; error: NextResponse };

async function authorizeImage(photoId: string): Promise<AuthResult> {
  const session = await auth();
  if (!session) return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const image = await prisma.image.findUnique({
    where: { id: photoId },
    include: { survey: { include: { droneJob: true } } },
  });
  if (!image) return { ok: false, error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const isOwner = image.survey.customerId === session.user.id;
  const isOperator =
    session.user.role === "drone" && image.survey.droneJob?.operatorId === session.user.id;
  if (!isOwner && !isOperator && session.user.role !== "admin") {
    return { ok: false, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, imageId: image.id };
}

function toPhotoTag(image: {
  id: string;
  roofParts: string[];
  aspect: string | null;
  captureMethod: string | null;
  taggedAt: Date | null;
}): PhotoTag {
  return {
    photoId: image.id,
    roofParts: image.roofParts as PhotoTag["roofParts"],
    aspect: image.aspect as PhotoTag["aspect"],
    captureMethod: image.captureMethod,
    taggedAt: image.taggedAt ? image.taggedAt.toISOString() : null,
  };
}

// Tap-to-tag a thumbnail. Idempotent — repeat calls with the same body produce
// the same end state. Each call replaces the full tag state (roofParts, aspect,
// captureMethod) — the client always sends the complete current selection, not
// a delta. roofParts: [] and aspect: null (or omitted) together untag the photo.
// Never gated on survey status — retagging after report generation is allowed.
export async function PATCH(req: Request, { params }: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await params;
  const authResult = await authorizeImage(photoId);
  if (!authResult.ok) return authResult.error;

  const body = await req.json();
  const parsed = PhotoTagSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { roofParts, aspect, captureMethod } = parsed.data;
  const hasAnyTag = roofParts.length > 0 || !!aspect;

  const updated = await prisma.image.update({
    where: { id: authResult.imageId },
    data: {
      roofParts,
      aspect: aspect ?? null,
      captureMethod: captureMethod ?? null,
      taggedAt: hasAnyTag ? new Date() : null,
    },
  });

  return NextResponse.json(toPhotoTag(updated));
}

// Explicit untag path, equivalent to PATCH { roofParts: [], aspect: null }.
export async function DELETE(req: Request, { params }: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await params;
  const authResult = await authorizeImage(photoId);
  if (!authResult.ok) return authResult.error;

  const updated = await prisma.image.update({
    where: { id: authResult.imageId },
    data: { roofParts: [], aspect: null, captureMethod: null, taggedAt: null },
  });

  return NextResponse.json(toPhotoTag(updated));
}
