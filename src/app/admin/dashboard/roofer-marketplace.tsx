// The roofer marketplace's part of the dashboard: shown only while the roofer
// journey is on (BL-080 / SPEC-029 A3, B2, D3). These were the dashboard's cards
// and claims list before the self-upload launch.
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export async function RooferMarketplace() {
  const [rooferCount, verifiedRooferCount, activeSubscriptions, openLeads, totalClaims, recentClaims] = await Promise.all([
    prisma.user.count({ where: { role: "roofer" } }),
    prisma.user.count({ where: { role: "roofer", verified: true } }),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.lead.count({ where: { status: "open" } }),
    prisma.leadClaim.count(),
    prisma.leadClaim.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        roofer: { select: { name: true, email: true } },
        lead: { include: { survey: { include: { property: { select: { address: true } } } } } },
      },
    }),
  ]);
  const cards = [
    { label: "Roofers", value: `${verifiedRooferCount} / ${rooferCount}`, sub: "verified / total", href: "/admin/roofers" },
    { label: "Active subscriptions", value: String(activeSubscriptions), href: "/admin/roofers" },
    { label: "Open leads", value: String(openLeads), href: "/admin/surveys" },
    { label: "Total claims", value: String(totalClaims), href: "/admin/surveys" },
  ];

  return (
    <section className="mt-10" data-testid="roofer-marketplace">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Roofer marketplace</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map(({ label, value, sub, href }) => (
          <Link key={label} href={href} className="bg-white border rounded-xl p-5 hover:bg-gray-50 transition">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </Link>
        ))}
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b"><h3 className="font-semibold text-gray-900">Recent claims</h3></div>
        {recentClaims.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No claims yet</p>
        ) : (
          <ul className="divide-y">
            {recentClaims.map((claim) => (
              <li key={claim.id} className="px-5 py-3 text-sm">
                {claim.roofer.name ?? claim.roofer.email} claimed {claim.lead.survey.property.address}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
