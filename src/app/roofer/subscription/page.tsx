import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscribeButton } from "./subscribe-button";
import { ManageButton } from "./manage-button";
import { ActivateDevSubscription } from "./activate-dev";
import { SuccessBanner } from "./success-banner";

const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    price: "£49",
    period: "/month",
    leads: "Up to 10 leads/month",
    features: ["Access to local leads", "Full report + contact details", "Email notifications"],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "£129",
    period: "/month",
    leads: "Unlimited leads",
    features: ["Everything in Basic", "Unlimited lead claims", "Priority lead notifications", "Profile badge"],
    highlight: true,
  },
];

export default async function SubscriptionPage() {
  const session = await auth();
  const userId = session!.user.id;

  const subscription = await prisma.subscription.findUnique({
    where: { rooferId: userId },
  });

  const isActive = subscription?.status === "active";
  const isPastDue = subscription?.status === "past_due";

  return (
    <div className="p-8 max-w-2xl">
      <Suspense>
        <SuccessBanner />
      </Suspense>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Subscription</h1>
      <p className="text-gray-500 mb-8">
        Choose a plan to start receiving roof survey leads in your area.
      </p>

      {/* Current plan banner */}
      {isActive && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-green-800 font-semibold">
                Active: {subscription!.plan === "pro" ? "Pro" : "Basic"} plan
                {subscription!.cancelAtPeriodEnd && (
                  <span className="ml-2 text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    Cancels at period end
                  </span>
                )}
              </p>
              <p className="text-sm text-green-600 mt-1">
                {subscription!.plan === "basic"
                  ? `${subscription!.leadCount} / 10 leads used this month`
                  : "Unlimited leads — no monthly cap"}
              </p>
              <p className="text-xs text-green-500 mt-1">
                {subscription!.cancelAtPeriodEnd ? "Access until" : "Renews"}{" "}
                {new Date(subscription!.currentPeriodEnd).toLocaleDateString("en-GB", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </p>
            </div>
            <ManageButton />
          </div>
        </div>
      )}

      {isPastDue && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-8">
          <p className="text-red-800 font-semibold">Payment failed</p>
          <p className="text-sm text-red-600 mt-1">
            Your last payment didn&apos;t go through. Update your payment method to keep access.
          </p>
          <div className="mt-3">
            <ManageButton label="Update payment method" />
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {PLANS.map((plan) => {
          const isCurrent = isActive && subscription?.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`bg-white border rounded-xl p-6 flex flex-col ${
                plan.highlight ? "border-blue-500 shadow-sm" : ""
              }`}
            >
              {plan.highlight && (
                <span className="text-xs font-medium bg-blue-600 text-white px-2.5 py-1 rounded-full mb-3 inline-block self-start">
                  Most popular
                </span>
              )}
              <p className="text-lg font-bold text-gray-900">{plan.name}</p>
              <p className="mt-1 mb-1">
                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </p>
              <p className="text-sm text-blue-600 font-medium mb-4">{plan.leads}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-green-500 font-bold">✓</span>{f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="block text-center text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg py-2">
                  Current plan
                </span>
              ) : (
                <SubscribeButton plan={plan.id} highlight={plan.highlight} />
              )}
            </div>
          );
        })}
      </div>

      {/* Dev activation (hidden in production) */}
      {process.env.NODE_ENV !== "production" && (
        <details className="mt-4">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Dev tools</summary>
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <ActivateDevSubscription currentPlan={subscription?.plan ?? null} isActive={isActive} />
          </div>
        </details>
      )}
    </div>
  );
}
