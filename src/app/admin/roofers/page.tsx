import { prisma } from "@/lib/prisma";
import { VerifyToggle } from "./verify-toggle";

export default async function AdminRoofersPage() {
  const roofers = await prisma.user.findMany({
    where: { role: "roofer" },
    orderBy: { createdAt: "desc" },
    include: {
      subscription: true,
      _count: { select: { leadClaims: true } },
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Roofer Verification</h1>
        <p className="text-sm text-gray-500">{roofers.length} roofer{roofers.length !== 1 ? "s" : ""} registered</p>
      </div>

      {roofers.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          No roofers registered yet.
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Roofer</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Company</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Postcode</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Subscription</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Leads claimed</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Joined</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {roofers.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{r.name ?? "—"}</p>
                    <p className="text-gray-400 text-xs">{r.email}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{r.company ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-600">{r.postcode ?? "—"}</td>
                  <td className="px-5 py-3">
                    {r.subscription ? (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        r.subscription.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {r.subscription.plan} · {r.subscription.status}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No subscription</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{r._count.leadClaims}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(r.createdAt).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-5 py-3">
                    <VerifyToggle userId={r.id} verified={r.verified} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
