import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function RooferDashboard() {
  const session = await auth();
  const userId = session!.user.id;

  const [subscription, claimCount] = await Promise.all([
    prisma.subscription.findUnique({ where: { rooferId: userId } }),
    prisma.leadClaim.count({ where: { rooferId: userId } }),
  ]);

  const isSubscribed = subscription?.status === "active";

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Roofer Dashboard</h1>
      <p className="text-gray-500 mb-8">
        {isSubscribed
          ? `${subscription!.plan === "pro" ? "Pro" : "Basic"} plan — ${subscription!.plan === "basic" ? `${subscription!.leadCount}/10` : "unlimited"} leads used this month`
          : "No active subscription"}
      </p>

      {!isSubscribed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
          <p className="font-semibold text-amber-900 mb-1">Subscribe to receive leads</p>
          <p className="text-sm text-amber-700 mb-4">
            You need an active subscription to claim leads and view customer contact details.
          </p>
          <Link
            href="/roofer/subscription"
            className="inline-block bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-amber-700"
          >
            View plans
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/roofer/leads"
          className="bg-white border rounded-xl p-6 hover:bg-gray-50 transition"
        >
          <p className="text-sm font-medium text-gray-500">Available leads</p>
          <p className="text-xl font-bold text-gray-900 mt-1">Browse leads →</p>
        </Link>
        <div className="bg-white border rounded-xl p-6">
          <p className="text-sm font-medium text-gray-500">Leads claimed</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{claimCount}</p>
        </div>
      </div>
    </div>
  );
}
