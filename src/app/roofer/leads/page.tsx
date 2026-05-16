import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const SCORE_COLOUR = (score: number) =>
  score <= 3 ? "text-red-600" :
  score <= 6 ? "text-amber-500" : "text-green-600";

export default async function RooferLeadsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [subscription, leads, myClaims] = await Promise.all([
    prisma.subscription.findUnique({ where: { rooferId: userId } }),
    prisma.lead.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      include: {
        report: { select: { conditionScore: true, confidence: true } },
        survey: { include: { property: { select: { postcode: true, town: true, type: true } } } },
        _count: { select: { claims: true } },
      },
    }),
    prisma.leadClaim.findMany({
      where: { rooferId: userId },
      select: { leadId: true },
    }),
  ]);

  const isSubscribed = subscription?.status === "active";
  const claimedLeadIds = new Set(myClaims.map((c) => c.leadId));

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Available Leads</h1>
      <p className="text-gray-500 mb-6">
        Roof surveys in your area that need a quote.
      </p>

      {!isSubscribed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <p className="font-semibold text-amber-900">Subscription required to claim leads</p>
          <p className="text-sm text-amber-700 mt-1 mb-3">
            You can browse leads, but need an active plan to claim them and see contact details.
          </p>
          <Link href="/roofer/subscription"
            className="inline-block bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700">
            View plans
          </Link>
        </div>
      )}

      {leads.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          No open leads at the moment — check back soon.
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => {
            const claimed = claimedLeadIds.has(lead.id);
            const property = lead.survey.property;

            return (
              <Link key={lead.id} href={`/roofer/leads/${lead.id}`}
                className="block bg-white border rounded-xl px-6 py-5 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Postcode always visible, full address only after claiming */}
                    <p className="font-semibold text-gray-900">
                      {property.postcode}{property.town ? ` · ${property.town}` : ""}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5 capitalize">
                      {property.type} property
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-2xl font-bold ${SCORE_COLOUR(lead.report.conditionScore)}`}>
                      {lead.report.conditionScore}/10
                    </p>
                    <p className="text-xs text-gray-400">condition score</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{lead._count.claims} / 3 claimed</span>
                    <span>·</span>
                    <span>AI confidence: {lead.report.confidence}</span>
                    <span>·</span>
                    <span>{new Date(lead.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                  {claimed ? (
                    <span className="text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                      Claimed ✓
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-blue-600">View lead →</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
