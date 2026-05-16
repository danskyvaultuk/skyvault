import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  s3Key: z.string().min(1),
  originalFilename: z.string().optional(),
  mimeType: z.string().default("image/jpeg"),
  sizeBytes: z.number().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: surveyId } = await params;
  const images = await prisma.image.findMany({
    where: { surveyId },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(images);
}

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

  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const image = await prisma.image.create({
    data: {
      surveyId,
      uploadedById: session.user.id,
      s3Key: parsed.data.s3Key,
      originalFilename: parsed.data.originalFilename,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      sortOrder: survey._count.images,
    },
  });

  return NextResponse.json(image, { status: 201 });
}
