import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const SCORE_COLOUR = (score: number) =>
  score <= 3 ? "text-red-600" : score <= 6 ? "text-amber-500" : "text-green-600";

export default async function QuotesPage() {
  const session = await auth();
  const userId = session!.user.id;

  // Find all leads that belong to this customer's surveys
  const leads = await prisma.lead.findMany({
    where: {
      survey: { customerId: userId },
    },
    orderBy: { createdAt: "desc" },
    include: {
      survey: {
        include: {
          property: { select: { address: true, postcode: true, type: true } },
        },
      },
      report: { select: { conditionScore: true, confidence: true } },
      claims: {
        include: {
          roofer: { select: { name: true, company: true, phone: true, email: true, verified: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Quote requests</h1>
      <p className="text-gray-500 mb-8">
        Roofers who have claimed your survey leads will appear here.
      </p>

      {leads.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          <p className="font-medium text-gray-600 mb-1">No leads yet</p>
          <p className="text-sm mb-4">Complete a roof survey to generate leads for local roofers.</p>
          <Link
            href="/surveys/new"
            className="inline-block bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800"
          >
            Start a survey
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {leads.map((lead) => {
            const property = lead.survey.property;
            const claimCount = lead.claims.length;

            return (
              <div key={lead.id} className="bg-white border rounded-xl overflow-hidden">
                {/* Lead header */}
                <div className="px-6 py-5 border-b flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{property.address}</p>
                    <p className="text-sm text-gray-500 mt-0.5 capitalize">
                      {property.postcode} · {property.type} property
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-2xl font-bold ${SCORE_COLOUR(lead.report.conditionScore)}`}>
                      {lead.report.conditionScore}/10
                    </p>
                    <p className="text-xs text-gray-400">condition score</p>
                  </div>
                </div>

                {/* Claim status banner */}
                <div className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${
                  claimCount === 0
                    ? "bg-amber-50 text-amber-700"
                    : "bg-green-50 text-green-700"
                }`}>
                  {claimCount === 0 ? (
                    <>
                      <span className="text-lg">⏳</span>
                      Waiting for roofers to claim this lead…
                    </>
                  ) : (
                    <>
                      <span className="text-lg">✓</span>
                      {claimCount} roofer{claimCount !== 1 ? "s" : ""} interested in this job
                    </>
                  )}
                </div>

                {/* Roofer cards */}
                {claimCount > 0 && (
                  <div className="divide-y">
                    {lead.claims.map((claim) => (
                      <div key={claim.id} className="px-6 py-4 flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">
                              {claim.roofer.name ?? "Roofer"}
                            </p>
                            {claim.roofer.verified && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                ✓ Verified
                              </span>
                            )}
                          </div>
                          {claim.roofer.company && (
                            <p className="text-sm text-gray-500 mt-0.5">{claim.roofer.company}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-3 text-sm">
                            {claim.roofer.email && (
                              <a
                                href={`mailto:${claim.roofer.email}`}
                                className="text-blue-600 hover:underline"
                              >
                                {claim.roofer.email}
                              </a>
                            )}
                            {claim.roofer.phone && (
                              <a
                                href={`tel:${claim.roofer.phone}`}
                                className="text-blue-600 hover:underline"
                              >
                                {claim.roofer.phone}
                              </a>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 shrink-0">
                          {new Date(claim.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Link to report */}
                <div className="px-6 py-3 border-t bg-gray-50">
                  <Link
                    href={`/surveys/${lead.surveyId}/report`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View your full report →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
