import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "roofer" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: leadId } = await params;
  const rooferId = session.user.id;

  const [lead, subscription, existing] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: leadId },
      include: { _count: { select: { claims: true } } },
    }),
    prisma.subscription.findUnique({ where: { rooferId } }),
    prisma.leadClaim.findUnique({
      where: { leadId_rooferId: { leadId, rooferId } },
    }),
  ]);

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.status !== "open") return NextResponse.json({ error: "Lead is no longer open" }, { status: 400 });
  if (existing) return NextResponse.json({ error: "Already claimed" }, { status: 400 });
  if (lead._count.claims >= lead.maxRoofers) {
    return NextResponse.json({ error: "Lead is fully claimed" }, { status: 400 });
  }

  // Must have active subscription
  if (!subscription || subscription.status !== "active") {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
  }

  // Basic plan: max 10 leads per month
  if (subscription.plan === "basic" && subscription.leadCount >= 10) {
    return NextResponse.json({ error: "Monthly lead limit reached. Upgrade to Pro for unlimited leads." }, { status: 403 });
  }

  // Create the claim and increment lead count in one transaction
  const [claim] = await prisma.$transaction([
    prisma.leadClaim.create({ data: { leadId, rooferId } }),
    prisma.subscription.update({
      where: { rooferId },
      data: { leadCount: { increment: 1 } },
    }),
  ]);

  return NextResponse.json(claim, { status: 201 });
}
