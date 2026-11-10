import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReportStatus } from "@prisma/client";
import { ReportReview, wasCorrected, type ReviewReport, type ReportReviewDeps } from "./reportReview";

const AI_DEFECTS = [
  { type: "moss_growth", severity: "low", description: "Moss on the north slope", image_index: 0 },
];
const AI_RAW = {
  condition_score: 7,
  defects: AI_DEFECTS,
  estimated_remaining_life_years: 15,
  recommendations: ["Remove the moss"],
  urgent_action_required: false,
  confidence: "medium",
  surveyor_notes: "Generally sound.",
};

function makeReport(status: ReportStatus, overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    id: "report-1",
    surveyId: "survey-1",
    status,
    conditionScore: 7,
    defectsJson: AI_DEFECTS,
    recommendations: ["Remove the moss"],
    estimatedRemainingLife: 15,
    confidence: "medium",
    rawAiResponse: AI_RAW,
    adminNotes: null,
    pdfS3Key: "surveys/survey-1/report.pdf",
    survey: {
      notes: null,
      roofContext: null,
      property: { address: "1 Test St", postcode: "SW1A 1AA" },
      customer: { email: "jane@example.com", name: "Jane" },
      images: [{ s3Key: "surveys/survey-1/images/0.jpg", originalFilename: "0.jpg" }],
    },
    ...overrides,
  };
}

const CORRECTION = {
  conditionScore: 4,
  defects: [
    { type: "flashing_damage", severity: "high", description: "Lifted flashing at the chimney", image_index: 0 },
  ],
  recommendations: ["Re-seat the chimney flashing"],
  adminNotes: "AI missed the flashing",
};

let deps: { [K in keyof ReportReviewDeps]: ReturnType<typeof vi.fn> };
let review: ReportReview;

function useReport(report: ReviewReport | null) {
  deps.findReport.mockResolvedValue(report);
}

beforeEach(() => {
  deps = {
    findReport: vi.fn(),
    updateReport: vi.fn(async () => undefined),
    fetchPhotos: vi.fn(async () => [{ base64: "AAAA", mimeType: "image/jpeg" }]),
    renderPdf: vi.fn(async () => Buffer.from("pdf")),
    storePdf: vi.fn(async () => undefined),
    pdfKeyFor: vi.fn((surveyId: string) => `surveys/${surveyId}/report.pdf`),
    notifyCustomer: vi.fn(async () => undefined),
  };
  review = new ReportReview(deps as unknown as ReportReviewDeps);
});

describe("ReportReview.correct", () => {
  it("updates a held report, re-makes the PDF from the corrected values, and keeps it held", async () => {
    useReport(makeReport("draft"));

    const result = await review.correct("report-1", CORRECTION);

    expect(result).toEqual({ ok: true, status: "draft" });
    const analysis = deps.renderPdf.mock.calls[0][0];
    expect(analysis).toMatchObject({
      condition_score: 4,
      defects: CORRECTION.defects,
      recommendations: CORRECTION.recommendations,
      surveyor_notes: "Generally sound.",
    });
    expect(deps.storePdf).toHaveBeenCalledWith("surveys/survey-1/report.pdf", Buffer.from("pdf"));
    const [, data] = deps.updateReport.mock.calls[0];
    expect(data).toMatchObject({
      conditionScore: 4,
      defectsJson: CORRECTION.defects,
      recommendations: CORRECTION.recommendations,
      adminNotes: "AI missed the flashing",
    });
    expect(data).not.toHaveProperty("rawAiResponse");
    expect(data).not.toHaveProperty("status");
    expect(deps.notifyCustomer).not.toHaveBeenCalled();
  });

  it("marks a released report overridden and sends no email", async () => {
    useReport(makeReport("published"));

    const result = await review.correct("report-1", CORRECTION);

    expect(result).toEqual({ ok: true, status: "overridden" });
    expect(deps.updateReport.mock.calls[0][1]).toMatchObject({ status: "overridden" });
    expect(deps.updateReport.mock.calls[0][1]).not.toHaveProperty("rawAiResponse");
    expect(deps.notifyCustomer).not.toHaveBeenCalled();
  });

  it.each([0, 11, 5.5])("refuses a score of %s and changes nothing", async (score) => {
    useReport(makeReport("draft"));

    const result = await review.correct("report-1", { ...CORRECTION, conditionScore: score });

    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(deps.updateReport).not.toHaveBeenCalled();
    expect(deps.storePdf).not.toHaveBeenCalled();
  });

  it("refuses an unknown severity and changes nothing", async () => {
    useReport(makeReport("draft"));
    const defects = [{ ...CORRECTION.defects[0], severity: "terrible" }];

    const result = await review.correct("report-1", { ...CORRECTION, defects });

    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(deps.updateReport).not.toHaveBeenCalled();
  });

  it("answers not-found for an unknown report", async () => {
    useReport(null);
    expect(await review.correct("missing", CORRECTION)).toMatchObject({ ok: false, reason: "not-found" });
    expect(deps.updateReport).not.toHaveBeenCalled();
  });
});

describe("ReportReview.approve", () => {
  it("publishes an uncorrected held report and emails the customer once", async () => {
    useReport(makeReport("draft"));

    const result = await review.approve("report-1");

    expect(result).toEqual({ ok: true, status: "published" });
    expect(deps.updateReport).toHaveBeenCalledWith("report-1", { status: "published" });
    expect(deps.notifyCustomer).toHaveBeenCalledTimes(1);
    expect(deps.notifyCustomer).toHaveBeenCalledWith({
      customerEmail: "jane@example.com",
      customerName: "Jane",
      surveyId: "survey-1",
    });
  });

  it("releases a corrected held report as overridden", async () => {
    useReport(makeReport("draft", { conditionScore: 4, adminNotes: null }));

    const result = await review.approve("report-1");

    expect(result).toEqual({ ok: true, status: "overridden" });
    expect(deps.updateReport).toHaveBeenCalledWith("report-1", { status: "overridden" });
    expect(deps.notifyCustomer).toHaveBeenCalledTimes(1);
  });

  it.each(["published", "overridden"] as const)("refuses an already %s report and sends no email", async (status) => {
    useReport(makeReport(status));

    const result = await review.approve("report-1");

    expect(result).toMatchObject({ ok: false, reason: "already-released" });
    expect(deps.updateReport).not.toHaveBeenCalled();
    expect(deps.notifyCustomer).not.toHaveBeenCalled();
  });
});

describe("wasCorrected", () => {
  it("is false when the report matches the AI's answer and has no notes", () => {
    expect(wasCorrected(makeReport("draft"))).toBe(false);
  });

  it.each([
    ["the score", { conditionScore: 3 }],
    ["the defects", { defectsJson: [] }],
    ["the recommendations", { recommendations: ["Something else"] }],
    ["admin notes", { adminNotes: "Checked the chimney" }],
  ])("is true when %s changed", (_label, overrides) => {
    expect(wasCorrected(makeReport("draft", overrides as Partial<ReviewReport>))).toBe(true);
  });
});

describe("ReportReview.resendEmail", () => {
  it.each(["published", "overridden"] as const)("re-sends the email once for a %s report and changes nothing", async (status) => {
    useReport(makeReport(status));

    const result = await review.resendEmail("report-1");

    expect(result).toEqual({ ok: true, status });
    expect(deps.notifyCustomer).toHaveBeenCalledTimes(1);
    expect(deps.notifyCustomer).toHaveBeenCalledWith({
      customerEmail: "jane@example.com",
      customerName: "Jane",
      surveyId: "survey-1",
    });
    expect(deps.updateReport).not.toHaveBeenCalled();
  });

  it("refuses a held report and sends nothing", async () => {
    useReport(makeReport("draft"));

    expect(await review.resendEmail("report-1")).toMatchObject({ ok: false, reason: "held" });
    expect(deps.notifyCustomer).not.toHaveBeenCalled();
  });

  it("answers not-found for an unknown report", async () => {
    useReport(null);
    expect(await review.resendEmail("missing")).toMatchObject({ ok: false, reason: "not-found" });
    expect(deps.notifyCustomer).not.toHaveBeenCalled();
  });
});
