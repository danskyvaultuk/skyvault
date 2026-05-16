import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivateDevSubscription } from "./activate-dev";

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: "£49",
    period: "/month",
    leads: "Up to 10 leads/month",
    features: ["Access to local leads", "Full report + contact details", "Email notifications"],
  },
  {
    id: "pro",
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

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Subscription</h1>
      <p className="text-gray-500 mb-8">
        Choose a plan to start receiving roof survey leads in your area.
      </p>

      {/* Current plan */}
      {isActive && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-8">
          <p className="text-green-800 font-semibold">
            Active: {subscription!.plan === "pro" ? "Pro" : "Basic"} plan
          </p>
          <p className="text-sm text-green-600 mt-1">
            {subscription!.plan === "basic"
              ? `${subscription!.leadCount} / 10 leads used this month`
              : "Unlimited leads — no monthly cap"}
          </p>
          <p className="text-xs text-green-500 mt-1">
            Renews {new Date(subscription!.currentPeriodEnd).toLocaleDateString("en-GB", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white border rounded-xl p-6 ${
              plan.highlight ? "border-blue-500 shadow-sm" : ""
            }`}
          >
            {plan.highlight && (
              <span className="text-xs font-medium bg-blue-600 text-white px-2.5 py-1 rounded-full mb-3 inline-block">
                Most popular
              </span>
            )}
            <p className="text-lg font-bold text-gray-900">{plan.name}</p>
            <p className="mt-1 mb-1">
              <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
              <span className="text-gray-500 text-sm">{plan.period}</span>
            </p>
            <p className="text-sm text-blue-600 font-medium mb-4">{plan.leads}</p>
            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-green-500 font-bold">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Stripe coming soon / dev activation */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <p className="text-amber-800 font-semibold text-sm mb-1">
          Stripe payments coming soon
        </p>
        <p className="text-amber-700 text-sm mb-4">
          Online card payments are being wired up. For now, activate a test subscription below to explore the roofer experience.
        </p>
        <ActivateDevSubscription currentPlan={subscription?.plan ?? null} isActive={isActive} />
      </div>
    </div>
  );
}
