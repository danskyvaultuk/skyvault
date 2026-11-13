import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { journeys } from "@/lib/journeys";
import { surveyCreationLimitReached } from "@/lib/surveyLimit";
import { SurveyNotesSchema } from "@/lib/surveyNotes";

const createSchema = z.object({
  propertyId: z.string().cuid(),
  type: z.enum(["self_upload", "drone_capture"]),
  notes: SurveyNotesSchema.optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where =
    session.user.role === "admin"
      ? {}
      : session.user.role === "drone"
        ? { droneJob: { operatorId: session.user.id } }
        : { customerId: session.user.id };

  const surveys = await prisma.survey.findMany({
    where,
    include: { property: true, report: { select: { conditionScore: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(surveys);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "customer" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Launch scope (BL-058): drone capture only while the drone journey is on.
  if (parsed.data.type === "drone_capture" && !journeys.droneEnabled) {
    return NextResponse.json({ error: "Drone capture is not available at the moment." }, { status: 403 });
  }

  const property = await prisma.property.findUnique({ where: { id: parsed.data.propertyId } });
  if (!property || property.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // At most 5 new surveys per customer per 24 hours (BL-066 / SPEC-021 C3).
  if (await surveyCreationLimitReached(session.user.id)) {
    return NextResponse.json(
      { error: "You've started the most surveys allowed in one day. Please try again tomorrow." },
      { status: 429 }
    );
  }

  const survey = await prisma.survey.create({
    data: {
      propertyId: parsed.data.propertyId,
      customerId: session.user.id,
      type: parsed.data.type,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json(survey, { status: 201 });
}
