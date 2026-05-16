import { prisma } from "@/lib/prisma";
import Link from "next/link";

const STATUS_COLOURS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  pending:   "bg-amber-100 text-amber-700",
  analysing: "bg-blue-100 text-blue-700",
  complete:  "bg-green-100 text-green-700",
  failed:    "bg-red-100 text-red-700",
};

export default async function AdminSurveysPage() {
  const surveys = await prisma.survey.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      property: true,
      customer: { select: { name: true, email: true } },
      report: { select: { conditionScore: true, status: true } },
      _count: { select: { images: true } },
    },
  });

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">All Surveys</h1>

      <div className="bg-white border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[750px]">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-600">Property</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Customer</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Images</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Score</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {surveys.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{s.property.address}</p>
                  <p className="text-gray-400 text-xs">{s.property.postcode}</p>
                </td>
                <td className="px-5 py-3">
                  <p className="text-gray-900">{s.customer.name ?? "—"}</p>
                  <p className="text-gray-400 text-xs">{s.customer.email}</p>
                </td>
                <td className="px-5 py-3 text-gray-600 capitalize">
                  {s.type.replace("_", " ")}
                </td>
                <td className="px-5 py-3 text-gray-600">{s._count.images}</td>
                <td className="px-5 py-3 font-semibold text-gray-900">
                  {s.report ? `${s.report.conditionScore}/10` : "—"}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLOURS[s.status] ?? ""}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {new Date(s.createdAt).toLocaleDateString("en-GB")}
                </td>
                <td className="px-5 py-3">
                  {s.report && (
                    <Link
                      href={`/surveys/${s.id}/report`}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      View report
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {surveys.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                  No surveys yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
