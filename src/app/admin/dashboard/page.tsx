import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { headers } from "next/headers";
import { appBaseUrlWithSource } from "@/lib/appUrl";
import { authBaseUrl } from "@/lib/authUrl";
import { siteAddressReport, type AddressLine } from "@/lib/siteAddressCheck";

// BL-069: the addresses email links and login use, so a stale setting is seen
// here first. Only addresses and setting names are shown, never a secret.
async function siteAddressLines(): Promise<AddressLine[]> {
  const h = await headers();
  return siteAddressReport({
    email: appBaseUrlWithSource({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    }),
    login: authBaseUrl({ AUTH_URL: process.env.AUTH_URL, NEXTAUTH_URL: process.env.NEXTAUTH_URL }),
    viewingHost: h.get("x-forwarded-host") ?? h.get("host"),
  });
}

function SiteAddresses({ lines }: { lines: AddressLine[] }) {
  const warned = lines.some((l) => l.warnings.length > 0);
  return (
    <div className={`border rounded-xl p-5 mb-8 ${warned ? "bg-amber-50 border-amber-200" : "bg-white"}`}>
      <h2 className="font-semibold text-gray-900 mb-2">Site addresses</h2>
      <ul className="space-y-2 text-sm">
        {lines.map((l) => (
          <li key={l.label}>
            <span className="text-gray-500">{l.label}:</span>{" "}
            <span className="font-medium text-gray-900 break-all">{l.address}</span>{" "}
            <span className="text-gray-400">(from {l.sourceText})</span>
            {l.warnings.map((w) => (
              <p key={w} className="text-amber-800">⚠ {w}</p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SCORE_COLOUR = (score: number) =>
  score <= 3 ? "text-red-600" : score <= 6 ? "text-amber-500" : "text-green-600";

export default async function AdminDashboard() {
  const [
    userCount,
    rooferCount,
    verifiedRooferCount,
    surveyCount,
    completedSurveyCount,
    activeSubscriptions,
    openLeads,
    totalClaims,
    recentSurveys,
    recentClaims,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "roofer" } }),
    prisma.user.count({ where: { role: "roofer", verified: true } }),
    prisma.survey.count(),
    prisma.survey.count({ where: { status: "complete" } }),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.lead.count({ where: { status: "open" } }),
    prisma.leadClaim.count(),
    prisma.survey.findMany({
      where: { status: "complete" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        property: { select: { address: true, postcode: true } },
        customer: { select: { name: true, email: true } },
        report: { select: { conditionScore: true } },
        lead: { include: { _count: { select: { claims: true } } } },
      },
    }),
    prisma.leadClaim.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        roofer: { select: { name: true, email: true } },
        lead: {
          include: {
            survey: { include: { property: { select: { address: true, postcode: true } } } },
          },
        },
      },
    }),
  ]);
  const addressLines = await siteAddressLines();

  const stats = [
    { label: "Total users", value: userCount, href: "/admin/users" },
    { label: "Roofers", value: `${verifiedRooferCount} / ${rooferCount}`, sub: "verified / total", href: "/admin/roofers" },
    { label: "Active subscriptions", value: activeSubscriptions, href: "/admin/roofers" },
    { label: "Surveys", value: `${completedSurveyCount} / ${surveyCount}`, sub: "complete / total", href: "/admin/surveys" },
    { label: "Open leads", value: openLeads, href: "/admin/surveys" },
    { label: "Total claims", value: totalClaims, href: "/admin/surveys" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      <SiteAddresses lines={addressLines} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {stats.map(({ label, value, sub, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-white border rounded-xl p-6 hover:bg-gray-50 transition"
          >
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent completed surveys */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent surveys</h2>
            <Link href="/admin/surveys" className="text-xs text-blue-600 hover:underline">
              View all →
            </Link>
          </div>
          {recentSurveys.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No completed surveys yet</p>
          ) : (
            <div className="divide-y">
              {recentSurveys.map((survey) => (
                <div key={survey.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {survey.property.address}
                    </p>
                    <p className="text-xs text-gray-400">
                      {survey.customer.email} · {new Date(survey.updatedAt).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {survey.report && (
                      <span className={`text-sm font-bold ${SCORE_COLOUR(survey.report.conditionScore)}`}>
                        {survey.report.conditionScore}/10
                      </span>
                    )}
                    {survey.lead && (
                      <span className="text-xs text-gray-500">
                        {survey.lead._count.claims}/{survey.lead.maxRoofers} claimed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent claims */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent claims</h2>
            <span className="text-xs text-gray-400">Last 5</span>
          </div>
          {recentClaims.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No claims yet</p>
          ) : (
            <div className="divide-y">
              {recentClaims.map((claim) => (
                <div key={claim.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {claim.roofer.name ?? claim.roofer.email}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      claimed {claim.lead.survey.property.address}
                    </p>
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
        </div>
      </div>
    </div>
  );
}
