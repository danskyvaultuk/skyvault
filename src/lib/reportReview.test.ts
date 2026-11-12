import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReportStatus } from "@prisma/client";
import { ReportReview, wasCorrected, type ReviewReport, type ReportReviewDeps } from "./reportReview";
import { correctionValues } from "./reportCorrection";

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

const STORED_PDF = Buffer.from("%PDF stored report");

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
    readPdf: vi.fn(async () => STORED_PDF),
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
      postcode: "SW1A 1AA",
      pdf: STORED_PDF,
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
      postcode: "SW1A 1AA",
      pdf: STORED_PDF,
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

describe("ReportReview.correct — priority, category, extent and location (BL-009)", () => {
  const NEW_STYLE = {
    type: "flashing_damage",
    severity: "high",
    description: "Lifted flashing at the chimney",
    image_index: 0,
    priority: "urgent",
    category: "functional",
    extent: "small",
    location: "right of the chimney",
  };

  it("accepts a correction carrying the new fields and puts them, with the photo labels, into the re-made PDF", async () => {
    useReport(
      makeReport("draft", {
        survey: { ...makeReport("draft").survey, images: [{ s3Key: "k0", originalFilename: "0.jpg", roofParts: ["front"] }] },
      })
    );

    const result = await review.correct("report-1", { ...CORRECTION, defects: [NEW_STYLE] });

    expect(result).toEqual({ ok: true, status: "draft" });
    const [analysis, , , , , , photoRoofParts] = deps.renderPdf.mock.calls[0];
    expect(analysis.defects[0]).toMatchObject({ priority: "urgent", category: "functional", extent: "small", location: "right of the chimney" });
    expect(photoRoofParts).toEqual([["front"]]);
    expect(deps.updateReport.mock.calls[0][1].defectsJson[0]).toMatchObject({ priority: "urgent" });
  });

  it("refuses an unknown priority and changes nothing", async () => {
    useReport(makeReport("draft"));
    const result = await review.correct("report-1", { ...CORRECTION, defects: [{ ...NEW_STYLE, priority: "whenever" }] });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(deps.updateReport).not.toHaveBeenCalled();
  });

  it("still accepts a defect from before BL-009, without the new fields", async () => {
    useReport(makeReport("draft"));
    const result = await review.correct("report-1", CORRECTION);
    expect(result).toEqual({ ok: true, status: "draft" });
  });
});

describe("correctionValues — loading a report into the review form", () => {
  it("lists every stored defect from before BL-009, none dropped", () => {
    const values = correctionValues({
      conditionScore: 6,
      defectsJson: [
        { type: "moss_growth", severity: "low", description: "Moss", image_index: 0 },
        { type: "cracked_tiles", severity: "high", description: "Cracked tile", image_index: 1 },
      ],
      recommendations: ["Clear the moss"],
      adminNotes: null,
    });
    expect(values.defects).toHaveLength(2);
    expect(values.defects[1]).toMatchObject({ type: "cracked_tiles", severity: "high" });
  });

  it("lists new-style defects with their priority and location", () => {
    const values = correctionValues({
      conditionScore: 3,
      defectsJson: [{ type: "other", severity: "high", description: "x", image_index: 0, priority: "urgent", category: "functional", extent: "large", location: "top" }],
      recommendations: [],
      adminNotes: "note",
    });
    expect(values.defects[0]).toMatchObject({ priority: "urgent", location: "top" });
  });
});

describe("ReportReview.approve — a report whose score was capped (SPEC-010 C2)", () => {
  it("approves an uncorrected capped report as published, not overridden", async () => {
    const capped = { ...AI_RAW, condition_score: 3, ai_condition_score: 7 };
    useReport(makeReport("draft", { conditionScore: 3, rawAiResponse: capped }));

    expect(wasCorrected(makeReport("draft", { conditionScore: 3, rawAiResponse: capped }))).toBe(false);
    expect(await review.approve("report-1")).toEqual({ ok: true, status: "published" });
    expect(deps.updateReport).toHaveBeenCalledWith("report-1", { status: "published" });
  });
});

describe("ReportReview.correct — peripheral zone and review flags (BL-004 / BL-010)", () => {
  const ZONED = {
    type: "gutter_damage",
    severity: "high",
    description: "Blocked gutter outlet",
    image_index: 0,
    priority: "high",
    category: "functional",
    extent: "small",
    location: "right-hand outlet",
    zone: "drainage_point",
  };
  const SHADOW = { reason: "low_light", description: "Rear slope in deep shadow", image_index: 0 };

  it("accepts a correction setting a zone, and the re-made PDF carries it and the AI's review flags", async () => {
    useReport(makeReport("draft", { rawAiResponse: { ...AI_RAW, review_flags: [SHADOW] } }));

    const result = await review.correct("report-1", { ...CORRECTION, defects: [ZONED] });

    expect(result).toEqual({ ok: true, status: "draft" });
    const [analysis] = deps.renderPdf.mock.calls[0];
    expect(analysis.defects[0]).toMatchObject({ zone: "drainage_point" });
    expect(analysis.review_flags).toEqual([SHADOW]);
    expect(deps.updateReport.mock.calls[0][1].defectsJson[0]).toMatchObject({ zone: "drainage_point" });
  });

  it("re-makes the PDF of a report from before flags existed with no flags", async () => {
    useReport(makeReport("draft"));
    await review.correct("report-1", CORRECTION);
    expect(deps.renderPdf.mock.calls[0][0].review_flags).toEqual([]);
  });

  it("refuses an unknown zone and changes nothing", async () => {
    useReport(makeReport("draft"));
    const result = await review.correct("report-1", { ...CORRECTION, defects: [{ ...ZONED, zone: "attic" }] });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(deps.updateReport).not.toHaveBeenCalled();
  });
});

describe("correctionValues — defects with and without a zone", () => {
  it("lists a stored defect without a zone, and keeps a stored zone", () => {
    const values = correctionValues({
      conditionScore: 5,
      defectsJson: [
        { type: "moss_growth", severity: "low", description: "Moss", image_index: 0, priority: "low", category: "cosmetic", extent: "small", location: "top" },
        { type: "gutter_damage", severity: "high", description: "Outlet", image_index: 1, priority: "high", category: "functional", extent: "small", location: "right", zone: "drainage_point" },
      ],
      recommendations: [],
      adminNotes: null,
    });
    expect(values.defects).toHaveLength(2);
    expect(values.defects[0].zone).toBeUndefined();
    expect(values.defects[1].zone).toBe("drainage_point");
  });
});

describe("the report ready email carries the stored PDF (BL-022)", () => {
  it("approval reads the stored PDF and passes it to the email", async () => {
    useReport(makeReport("draft"));
    await review.approve("report-1");
    expect(deps.readPdf).toHaveBeenCalledWith("surveys/survey-1/report.pdf");
    expect(deps.notifyCustomer.mock.calls[0][0]).toMatchObject({ pdf: STORED_PDF, postcode: "SW1A 1AA" });
  });

  it("re-send reads the stored PDF and passes it to the email", async () => {
    useReport(makeReport("published"));
    await review.resendEmail("report-1");
    expect(deps.readPdf).toHaveBeenCalledWith("surveys/survey-1/report.pdf");
    expect(deps.notifyCustomer.mock.calls[0][0]).toMatchObject({ pdf: STORED_PDF });
  });

  it("still approves and emails, without a PDF, when the report has no stored PDF", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    useReport(makeReport("draft", { pdfS3Key: null }));

    expect(await review.approve("report-1")).toEqual({ ok: true, status: "published" });
    expect(deps.readPdf).not.toHaveBeenCalled();
    expect(deps.notifyCustomer.mock.calls[0][0]).toMatchObject({ pdf: null });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("still approves and emails, without a PDF, when reading it fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useReport(makeReport("draft"));
    deps.readPdf.mockRejectedValueOnce(new Error("storage down"));

    expect(await review.approve("report-1")).toEqual({ ok: true, status: "published" });
    expect(deps.updateReport).toHaveBeenCalledWith("report-1", { status: "published" });
    expect(deps.notifyCustomer.mock.calls[0][0]).toMatchObject({ pdf: null });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
