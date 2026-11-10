import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MarkHandledButton } from "./mark-handled";

// Customers who asked to be put in touch with a roofer (BL-060), newest first.
// The admin brokers each one by hand, then marks it handled.
export default async function RooferRequestsPage() {
  const session = await auth();
  if (!session || session.user.role !== "admin") redirect("/login");

  const requests = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      survey: {
        select: {
          id: true,
          property: { select: { address: true } },
          customer: { select: { name: true, email: true } },
        },
      },
    },
  });

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Roofer requests</h1>
      <p className="text-gray-500 mb-6">
        Customers who asked to be put in touch with a roofer, and agreed to share their details. Newest first.
      </p>

      {requests.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-500">No requests yet.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-white border rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">
                  {r.survey.property.address}, {r.postcode}
                </p>
                <p className="text-sm text-gray-600">
                  {r.survey.customer.name ?? "—"} · {r.survey.customer.email}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Requested {new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  <Link href={`/surveys/${r.survey.id}/report`} className="text-blue-600 hover:underline">
                    View report
                  </Link>
                </p>
              </div>
              {r.status === "open" ? (
                <MarkHandledButton requestId={r.id} />
              ) : (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">Handled</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
