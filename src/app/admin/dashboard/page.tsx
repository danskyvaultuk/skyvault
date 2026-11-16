import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { appBaseUrlWithSource } from "@/lib/appUrl";
import { authBaseUrl } from "@/lib/authUrl";
import { siteAddressReport, type AddressLine } from "@/lib/siteAddressCheck";
import { journeys } from "@/lib/journeys";
import { dashboardCards, loadAdminDashboard, type DashboardGroup, type NewCustomer, type RecentSurvey } from "@/lib/adminDashboard";
import { RooferMarketplace } from "./roofer-marketplace";

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

function CardGroups({ groups }: { groups: DashboardGroup[] }) {
  return (
    <div className="space-y-8 mb-10">
      {groups.map((group) => (
        <section key={group.heading}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">{group.heading}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {group.cards.map(({ label, value, detail, href }) => (
              <Link key={label} href={href} className="bg-white border rounded-xl p-5 hover:bg-gray-50 transition">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                {detail && <p className="text-xs text-gray-400 mt-1">{detail}</p>}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const shortDate = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function RecentSurveys({ surveys }: { surveys: RecentSurvey[] }) {
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Recent surveys</h2>
        <Link href="/admin/surveys" className="text-xs text-blue-600 hover:underline">View all →</Link>
      </div>
      {surveys.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-400 text-center">No surveys yet</p>
      ) : (
        <ul className="divide-y">
          {surveys.map((survey) => (
            <li key={survey.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{survey.property.address}</p>
                <p className="text-xs text-gray-400 truncate">
                  {survey.customer.name ?? survey.customer.email} · {survey.status} · {shortDate(survey.createdAt)}
                </p>
              </div>
              {survey.report && (
                <Link href={`/admin/reports/${survey.report.id}`} className="text-xs text-blue-600 hover:underline shrink-0">
                  Review →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewCustomers({ customers }: { customers: NewCustomer[] }) {
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">New customers</h2>
        <Link href="/admin/users" className="text-xs text-blue-600 hover:underline">View all →</Link>
      </div>
      {customers.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-400 text-center">No customers yet</p>
      ) : (
        <ul className="divide-y">
          {customers.map((customer) => (
            <li key={customer.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-900 truncate">{customer.name ?? customer.email}</p>
              <p className="text-xs text-gray-400 shrink-0">joined {shortDate(customer.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The launch dashboard (BL-080 / SPEC-029): what the admin acts on and watches.
// The roofer marketplace's cards and claims return when that journey is on.
export default async function AdminDashboard() {
  // Each admin page checks the role itself (BL-066 / SPEC-021 B2).
  const session = await auth();
  if (!session || session.user.role !== "admin") redirect("/login");

  const [data, addressLines] = await Promise.all([loadAdminDashboard(), siteAddressLines()]);

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
      <SiteAddresses lines={addressLines} />
      <CardGroups groups={dashboardCards(data)} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RecentSurveys surveys={data.recentSurveys} />
        <NewCustomers customers={data.newCustomers} />
      </div>
      {journeys.rooferEnabled && <RooferMarketplace />}
    </div>
  );
}
