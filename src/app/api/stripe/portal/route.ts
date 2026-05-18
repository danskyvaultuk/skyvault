import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await prisma.subscription.findUnique({
    where: { rooferId: session.user.id },
  });

  if (!subscription) return NextResponse.json({ error: "No subscription found" }, { status: 404 });

  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${origin}/roofer/subscription`,
  });

  return NextResponse.json({ url: portalSession.url });
}
