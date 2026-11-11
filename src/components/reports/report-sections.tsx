// Report sections shared by the customer report page and the admin's preview of
// it (BL-009, BL-004, BL-010), so both show a report the same way.
import type { CustomerDefect } from "@/lib/defectDisplay";
import type { AssessmentGap } from "@/lib/reviewFlags";

// Priority badge colours; "critical" only appears on reports from before priorities existed.
const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

function DefectRow({ defect }: { defect: CustomerDefect }) {
  return (
    <div className="px-5 py-4 flex items-start gap-4">
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${PRIORITY_STYLES[defect.key] ?? PRIORITY_STYLES.low}`}>
        {defect.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {defect.typeText}
          {defect.zoneText && <span className="font-normal text-gray-500"> · {defect.zoneText}</span>}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">{defect.description}</p>
        <p className="text-xs text-gray-500 mt-1">{defect.locationText}</p>
        {defect.categoryText && <p className="text-xs text-gray-400 mt-0.5">{defect.categoryText}</p>}
      </div>
    </div>
  );
}

/** A titled list of defects; nothing when the list is empty. */
export function DefectCard({ title, intro, defects }: { title: string; intro?: string; defects: CustomerDefect[] }) {
  if (defects.length === 0) return null;
  return (
    <div className="bg-white border rounded-xl mb-6 overflow-hidden">
      <div className="px-5 py-4 border-b">
        <h2 className="font-semibold text-gray-900">{title} ({defects.length})</h2>
        {intro && <p className="text-xs text-gray-500 mt-1">{intro}</p>}
      </div>
      <div className="divide-y">
        {defects.map((d, i) => <DefectRow key={i} defect={d} />)}
      </div>
    </div>
  );
}

/** "Areas we couldn't assess" (SPEC-013 D1); nothing when there are none. */
export function AssessmentGapsCard({ gaps }: { gaps: AssessmentGap[] }) {
  if (gaps.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6">
      <h2 className="font-semibold text-amber-900">Areas we couldn&apos;t assess</h2>
      <p className="text-xs text-amber-800 mt-1 mb-2">
        Our survey couldn&apos;t judge these from the photos. A roofer may want to look at them in person.
      </p>
      <ul className="list-disc pl-5 space-y-1 text-sm text-amber-900">
        {gaps.map((g, i) => (
          <li key={i}>
            {g.description}
            {g.photoText && <span className="text-amber-700"> ({g.photoText})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
