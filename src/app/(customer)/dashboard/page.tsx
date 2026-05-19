import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SCORE_COLOUR = (score: number) =>
  score <= 3 ? "text-red-600" : score <= 6 ? "text-amber-500" : "text-green-600";

const STATUS_BADGE: Record<string, { label: string; colour: string }> = {
  draft:      { label: "Draft",        colour: "bg-gray-100 text-gray-600" },
  pending:    { label: "Pending",       colour: "bg-amber-100 text-amber-700" },
  analysing:  { label: "Analysing…",   colour: "bg-blue-100 text-blue-700" },
  complete:   { label: "Report ready", colour: "bg-green-100 text-green-700" },
  failed:     { label: "Failed",        colour: "bg-red-100 text-red-700" },
};

export default async function CustomerDashboard() {
  const session = await auth();
  const userId = session!.user.id;
  const firstName = session?.user?.name?.split(" ")[0] ?? null;

  const [properties, recentSurveys, activeClaims] = await Promise.all([
    prisma.property.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.survey.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        property: { select: { address: true, postcode: true } },
        report: { select: { conditionScore: true, confidence: true } },
        lead: { include: { _count: { select: { claims: true } } } },
      },
    }),
    // Count total roofer claims across all this customer's leads
    prisma.leadClaim.count({
      where: { lead: { survey: { customerId: userId } } },
    }),
  ]);

  const completedSurveys = recentSurveys.filter((s) => s.status === "complete");
  const isNewUser = properties.length === 0;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {firstName ? `Welcome back, ${firstName}` : "Welcome to SkyVault"}
      </h1>
      <p className="text-gray-500 mb-8">
        {isNewUser
          ? "Get started by adding your first property."
          : `${properties.length} propert${properties.length !== 1 ? "ies" : "y"} · ${recentSurveys.length} survey${recentSurveys.length !== 1 ? "s" : ""} · ${activeClaims} roofer interest${activeClaims !== 1 ? "s" : ""}`}
      </p>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <Link
          href="/surveys/new"
          className="bg-blue-700 text-white rounded-xl p-6 hover:bg-blue-800 transition"
        >
          <p className="text-2xl mb-2">📸</p>
          <p className="font-semibold">New survey</p>
          <p className="text-sm text-blue-200 mt-0.5">Upload photos or book a drone</p>
        </Link>
        <Link
          href="/properties/new"
          className="bg-white border rounded-xl p-6 hover:bg-gray-50 transition"
        >
          <p className="text-2xl mb-2">🏠</p>
          <p className="font-semibold text-gray-900">Add property</p>
          <p className="text-sm text-gray-500 mt-0.5">Register a new address</p>
        </Link>
        <Link
          href="/quotes"
          className="bg-white border rounded-xl p-6 hover:bg-gray-50 transition relative"
        >
          <p className="text-2xl mb-2">🔨</p>
          <p className="font-semibold text-gray-900">Roofer quotes</p>
          <p className="text-sm text-gray-500 mt-0.5">See who's interested</p>
          {activeClaims > 0 && (
            <span className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {activeClaims}
            </span>
          )}
        </Link>
      </div>

      {/* New user guide */}
      {isNewUser && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <h2 className="font-semibold text-blue-900 mb-4">Get your first report in 3 steps</h2>
          <ol className="space-y-3">
            {[
              { n: 1, text: "Add your property", href: "/properties/new", cta: "Add property" },
              { n: 2, text: "Start a survey and upload roof photos (or book a drone)", href: "/surveys/new", cta: "Start survey" },
              { n: 3, text: "Run AI analysis — get a full report in under a minute", href: null, cta: null },
            ].map(({ n, text, href, cta }) => (
              <li key={n} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-blue-700 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {n}
                </span>
                <span className="text-sm text-blue-800 flex-1">{text}</span>
                {href && cta && (
                  <Link href={href} className="text-xs font-medium text-blue-700 hover:underline shrink-0">
                    {cta} →
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Recent surveys */}
      {recentSurveys.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent surveys</h2>
            <Link href="/surveys" className="text-sm text-blue-600 hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {recentSurveys.map((survey) => {
              const badge = STATUS_BADGE[survey.status] ?? STATUS_BADGE.draft;
              const claimCount = survey.lead?._count.claims ?? 0;

              return (
                <Link
                  key={survey.id}
                  href={survey.status === "complete" ? `/surveys/${survey.id}/report` : `/surveys/${survey.id}`}
                  className="flex items-center justify-between bg-white border rounded-xl px-5 py-4 hover:bg-gray-50 transition gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{survey.property.address}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.colour}`}>
                        {badge.label}
                      </span>
                      {claimCount > 0 && (
                        <span className="text-xs text-green-600 font-medium">
                          {claimCount} roofer{claimCount !== 1 ? "s" : ""} interested
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {survey.report ? (
                      <>
                        <p className={`text-2xl font-bold ${SCORE_COLOUR(survey.report.conditionScore)}`}>
                          {survey.report.conditionScore}/10
                        </p>
                        <p className="text-xs text-gray-400">condition</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">—</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Properties list (when not new user but no surveys yet) */}
      {!isNewUser && recentSurveys.length === 0 && (
        <div className="bg-white border rounded-xl p-8 text-center mb-8">
          <p className="text-gray-600 mb-4">No surveys yet. Start one to get your first roof report.</p>
          <Link
            href="/surveys/new"
            className="inline-block bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-800"
          >
            Start a survey →
          </Link>
        </div>
      )}

      {/* Summary stats — only when there's data */}
      {completedSurveys.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-4">
          <div className="bg-white border rounded-xl px-5 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{properties.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Properties</p>
          </div>
          <div className="bg-white border rounded-xl px-5 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{completedSurveys.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Reports</p>
          </div>
          <div className="bg-white border rounded-xl px-5 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{activeClaims}</p>
            <p className="text-xs text-gray-500 mt-0.5">Roofer interests</p>
          </div>
        </div>
      )}
    </div>
  );
}
