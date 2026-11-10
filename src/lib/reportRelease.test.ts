import { describe, it, expect } from "vitest";
import { isReportReleased, reportForViewer } from "./reportRelease";

const REPORT = {
  id: "report-1",
  status: "draft" as const,
  conditionScore: 6,
  defectsJson: [{ type: "other", severity: "low", description: "x", image_index: 0 }],
  recommendations: ["Clear the gutters"],
  pdfS3Key: "surveys/s1/report.pdf",
  adminNotes: "AI missed the flashing",
};

describe("isReportReleased", () => {
  it("holds a draft report", () => {
    expect(isReportReleased("draft")).toBe(false);
  });

  it.each(["published", "overridden"] as const)("releases a %s report", (status) => {
    expect(isReportReleased(status)).toBe(true);
  });
});

describe("reportForViewer", () => {
  it("gives a non-admin only the id and status of a held report", () => {
    expect(reportForViewer(REPORT, false)).toEqual({ id: "report-1", status: "draft" });
  });

  it("gives a non-admin a released report without the admin notes", () => {
    const view = reportForViewer({ ...REPORT, status: "published" }, false);
    expect(view).toMatchObject({ id: "report-1", conditionScore: 6, pdfS3Key: "surveys/s1/report.pdf" });
    expect(view).not.toHaveProperty("adminNotes");
  });

  it("gives an admin the whole report, held or not", () => {
    expect(reportForViewer(REPORT, true)).toEqual(REPORT);
  });

  it("passes a missing report through", () => {
    expect(reportForViewer(null, false)).toBeNull();
  });
});
