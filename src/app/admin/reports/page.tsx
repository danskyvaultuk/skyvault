import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Reports held for review (BL-061): every new report waits here until an
// admin approves it. Oldest first, so nobody waits longest.
export default async function ReportsToReviewPage() {
  const reports = await prisma.report.findMany({
    where: { status: "draft" },
    orderBy: { createdAt: "asc" },
    include: {
      survey: {
        select: {
          property: { select: { address: true, postcode: true } },
          customer: { select: { name: true, email: true } },
        },
      },
    },
  });

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Reports to review</h1>
      <p className="text-gray-500 mb-6">
        Customers can&apos;t see these reports until you approve them. Oldest first.
      </p>

      {reports.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-500">
          Nothing waiting — every report has been reviewed.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Link
              key={r.id}
              href={`/admin/reports/${r.id}`}
              className="flex items-center justify-between bg-white border rounded-xl px-5 py-4 hover:bg-gray-50 gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{r.survey.property.address}</p>
                <p className="text-xs text-gray-400">{r.survey.property.postcode}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {r.survey.customer.name ?? "—"} · {r.survey.customer.email}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm text-gray-500">
                  {new Date(r.createdAt).toLocaleString("en-GB", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                <p className="text-sm font-medium text-blue-600 mt-1">Review →</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
