// Shown to an admin on a customer's report page (BL-070), so the admin always
// knows it is the customer's view and can get back to the admin pages,
// whatever the report's status. Customers never see it.
import Link from "next/link";

export function AdminViewBar({ reportId, held }: { reportId: string; held: boolean }) {
  return (
    <div className={`border rounded-xl px-5 py-3 mb-6 flex flex-wrap items-center justify-between gap-3 ${held ? "bg-amber-50 border-amber-200" : "bg-gray-100 border-gray-200"}`}>
      <p className={`text-sm font-semibold ${held ? "text-amber-800" : "text-gray-700"}`}>
        {held ? "Held for review — the customer cannot see this report yet" : "Admin view — this is what the customer sees"}
      </p>
      <div className="flex gap-4 text-sm">
        <Link href={`/admin/reports/${reportId}`} className="text-blue-600 hover:underline">← Back to review</Link>
        <Link href="/admin/surveys" className="text-blue-600 hover:underline">All surveys</Link>
      </div>
    </div>
  );
}
