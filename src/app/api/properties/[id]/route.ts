import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  address: z.string().min(5).optional(),
  postcode: z.string().min(3).max(8).optional(),
  town: z.string().optional(),
  type: z.enum(["residential", "commercial"]).optional(),
});

async function getProperty(id: string, userId: string, role: string) {
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) return null;
  if (role !== "admin" && property.ownerId !== userId) return null;
  return property;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: { surveys: { orderBy: { createdAt: "desc" } } },
  });

  if (!property || (session.user.role !== "admin" && property.ownerId !== session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(property);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const property = await getProperty(id, session.user.id, session.user.role);
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.property.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const property = await getProperty(id, session.user.id, session.user.role);
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const activeSurveys = await prisma.survey.count({
    where: { propertyId: id, status: { in: ["draft", "analysing", "pending"] } },
  });
  if (activeSurveys > 0) {
    return NextResponse.json({ error: "Property has active surveys" }, { status: 409 });
  }

  await prisma.property.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
