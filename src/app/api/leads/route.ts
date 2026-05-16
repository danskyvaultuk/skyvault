import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "roofer" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const leads = await prisma.lead.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    include: {
      report: { select: { conditionScore: true, confidence: true } },
      survey: {
        include: {
          property: { select: { postcode: true, town: true, type: true } },
        },
      },
      _count: { select: { claims: true } },
    },
  });

  return NextResponse.json(leads);
}
