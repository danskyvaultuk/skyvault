import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const DEPOSIT_PENCE = 5000; // £50

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { surveyId, scheduledAt } = await req.json();

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: { property: true, droneJob: true },
  });

  if (!survey || survey.customerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (survey.type !== "drone_capture") {
    return NextResponse.json({ error: "Not a drone survey" }, { status: 400 });
  }
  if (survey.droneJob) {
    return NextResponse.json({ error: "Already booked" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name: "Drone Roof Survey",
            description: `${survey.property.address}, ${survey.property.postcode}`,
          },
          unit_amount: DEPOSIT_PENCE,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "drone_deposit",
      surveyId: survey.id,
      scheduledAt: scheduledAt ?? "",
      postcode: survey.property.postcode,
    },
    success_url: `${origin}/surveys/${survey.id}?booked=1`,
    cancel_url: `${origin}/surveys/${survey.id}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
