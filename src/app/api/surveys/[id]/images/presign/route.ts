import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, getPresignedUploadUrl } from "@/lib/r2";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_IMAGES = 10;

const schema = z.object({
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().max(20 * 1024 * 1024),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: surveyId } = await params;
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: { droneJob: true, _count: { select: { images: true } } },
  });

  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = survey.customerId === session.user.id;
  const isOperator =
    session.user.role === "drone" &&
    survey.droneJob?.operatorId === session.user.id;
  if (!isOwner && !isOperator && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (survey._count.images >= MAX_IMAGES) {
    return NextResponse.json({ error: "Maximum 10 images per survey" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { filename, contentType, sizeBytes } = parsed.data;

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "Only JPEG, PNG and WebP images are allowed" }, { status: 400 });
  }

  const s3Key = generateS3Key(surveyId, filename);
  const uploadUrl = await getPresignedUploadUrl(s3Key, contentType);

  return NextResponse.json({ s3Key, uploadUrl, sizeBytes });
}
