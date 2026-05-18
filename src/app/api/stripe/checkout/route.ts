import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, PRICE_IDS } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "roofer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { plan } = await req.json() as { plan: "basic" | "pro" };
  if (!PRICE_IDS[plan]) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const userId = session.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Reuse existing Stripe customer if they have a subscription
  const existing = await prisma.subscription.findUnique({ where: { rooferId: userId } });
  let customerId = existing?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId },
    });
    customerId = customer.id;
  }

  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${origin}/roofer/subscription?success=1`,
    cancel_url: `${origin}/roofer/subscription?cancelled=1`,
    metadata: { userId, plan },
    subscription_data: { metadata: { userId, plan } },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
