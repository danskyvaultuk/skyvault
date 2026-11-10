// Launch rule (BL-061): every report is held until an admin approves it.
// A report is released to its customer once it is `published` (approved as
// the AI wrote it) or `overridden` (approved or corrected by an admin).
// `draft` means held: the customer sees only that it is being checked.
import type { ReportStatus } from "@prisma/client";

const RELEASED: readonly ReportStatus[] = ["published", "overridden"];

export function isReportReleased(status: ReportStatus): boolean {
  return RELEASED.includes(status);
}

type ViewableReport = { id: string; status: ReportStatus; adminNotes?: string | null };

export type HeldReportView = { id: string; status: ReportStatus };

/**
 * The part of a report a viewer may see. An admin sees everything. A customer
 * sees a released report without the private admin notes, and of a held
 * report only that it exists and is held.
 */
export function reportForViewer<R extends ViewableReport>(
  report: R | null,
  isAdmin: boolean
): R | Omit<R, "adminNotes"> | HeldReportView | null {
  if (!report || isAdmin) return report;
  if (!isReportReleased(report.status)) return { id: report.id, status: report.status };
  const { adminNotes: _private, ...visible } = report;
  return visible;
}
