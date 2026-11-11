// Where a report stands in the admin's review (BL-068), worded for the admin
// pages. Whether it is still waiting comes from the one release rule
// (src/lib/reportRelease.ts), so the two can never disagree.
import type { ReportStatus } from "@prisma/client";
import { isReportReleased } from "./reportRelease";

const LABELS: Record<ReportStatus, string> = {
  draft: "Waiting for review",
  published: "Approved",
  overridden: "Approved with changes",
};

export type ReviewStatus = { label: string; waiting: boolean };

export function reviewStatus(status: ReportStatus): ReviewStatus {
  return { label: LABELS[status], waiting: !isReportReleased(status) };
}
