import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

function planFromPriceId(priceId: string): "basic" | "pro" | null {
  if (priceId === process.env.STRIPE_BASIC_PRICE_ID) return "basic";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  return null;
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) return;

  const item = sub.items.data[0];
  const priceId = item?.price.id;
  const plan = planFromPriceId(priceId);
  if (!plan) return;

  const statusMap: Record<string, "active" | "past_due" | "cancelled"> = {
    active: "active",
    past_due: "past_due",
    canceled: "cancelled",
    cancelled: "cancelled",
    unpaid: "past_due",
  };
  const status = statusMap[sub.status] ?? "past_due";

  // current_period_start/end moved to the subscription item in API v2026-04-22.dahlia
  const periodStart = new Date((item?.current_period_start ?? sub.billing_cycle_anchor) * 1000);
  const periodEnd = new Date((item?.current_period_end ?? sub.billing_cycle_anchor) * 1000);

  await prisma.subscription.upsert({
    where: { rooferId: userId },
    create: {
      rooferId: userId,
      plan,
      status,
      stripeSubId: sub.id,
      stripeCustomerId: sub.customer as string,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    update: {
      plan,
      status,
      stripeSubId: sub.id,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) {
        await prisma.subscription.updateMany({
          where: { rooferId: userId },
          data: { status: "cancelled" },
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subRef = invoice.parent?.subscription_details?.subscription;
      const subId = typeof subRef === "string" ? subRef : subRef?.id;
      if (subId) {
        await prisma.subscription.updateMany({
          where: { stripeSubId: subId },
          data: { status: "past_due" },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
