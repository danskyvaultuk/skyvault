import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST — activate a dev subscription (basic or pro)
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "roofer" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { plan } = await req.json();
  if (plan !== "basic" && plan !== "pro") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const rooferId = session.user.id;
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscription = await prisma.subscription.upsert({
    where: { rooferId },
    update: {
      plan,
      status: "active",
      leadCount: 0,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
    create: {
      rooferId,
      plan,
      status: "active",
      stripeSubId: `dev_${rooferId}_${Date.now()}`,
      stripeCustomerId: `dev_cus_${rooferId}`,
      leadCount: 0,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  return NextResponse.json(subscription);
}

// DELETE — cancel dev subscription
export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "roofer" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rooferId = session.user.id;

  await prisma.subscription.updateMany({
    where: { rooferId },
    data: { status: "cancelled" },
  });

  return NextResponse.json({ ok: true });
}
