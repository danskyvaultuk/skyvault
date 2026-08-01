import { describe, it, expect, vi, beforeEach } from "vitest";

// This test exists specifically to lock in an SV-046 acceptance criterion:
// tagging (or skipping it) must never affect report generation. SV-048 (not
// built yet) is the ticket that will make the pipeline actually *read* tags —
// until then, this test proves the pipeline is fully indifferent to their
// presence, value, or absence.

const mockSurveyFindUnique = vi.fn();
const mockSurveyUpdate = vi.fn();
const mockReportCreate = vi.fn();
const mockAnalyzeRoof = vi.fn();
const mockUploadBuffer = vi.fn();
const mockDistributeLeads = vi.fn();
const mockNotifyCustomer = vi.fn();
const mockRenderReportPDF = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    survey: {
      findUnique: (...args: unknown[]) => mockSurveyFindUnique(...args),
      update: (...args: unknown[]) => mockSurveyUpdate(...args),
    },
    report: {
      create: (...args: unknown[]) => mockReportCreate(...args),
    },
  },
}));

vi.mock("@/lib/r2", () => ({
  getPresignedReadUrl: vi.fn(async () => "https://example.com/fake-signed-url"),
  generatePdfKey: vi.fn(() => "surveys/s1/report.pdf"),
  uploadBuffer: (...args: unknown[]) => mockUploadBuffer(...args),
}));

vi.mock("@/lib/claude", () => ({
  analyzeRoof: (...args: unknown[]) => mockAnalyzeRoof(...args),
}));

vi.mock("@/lib/pdf", () => ({
  renderReportPDF: (...args: unknown[]) => mockRenderReportPDF(...args),
}));

vi.mock("@/lib/leads", () => ({
  distributeLeads: (...args: unknown[]) => mockDistributeLeads(...args),
}));

vi.mock("@/lib/resend", () => ({
  notifyCustomerReportReady: (...args: unknown[]) => mockNotifyCustomer(...args),
}));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    resize: () => ({
      jpeg: () => ({
        toBuffer: async () => Buffer.from("fake-resized-image"),
      }),
    }),
  })),
}));

const { runAnalysisPipeline } = await import("./pipeline");

const VALID_ANALYSIS = {
  condition_score: 8,
  defects: [],
  estimated_remaining_life_years: 20,
  recommendations: [],
  urgent_action_required: false,
  confidence: "high",
  surveyor_notes: "Looks fine.",
};

function makeSurvey(images: Array<Partial<Record<string, unknown>>>) {
  return {
    id: "survey-1",
    notes: null,
    property: { address: "1 Test St", postcode: "SW1A 1AA" },
    customer: { email: "a@b.com", name: "Test" },
    images: images.map((img, i) => ({
      id: `img-${i}`,
      s3Key: `surveys/survey-1/images/${i}.jpg`,
      originalFilename: `${i}.jpg`,
      sortOrder: i,
      roofPart: null,
      captureMethod: null,
      taggedAt: null,
      ...img,
    })),
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  );
  mockSurveyFindUnique.mockReset();
  mockSurveyUpdate.mockReset().mockResolvedValue({});
  mockReportCreate.mockReset().mockResolvedValue({ id: "report-1" });
  mockAnalyzeRoof.mockReset().mockResolvedValue(VALID_ANALYSIS);
  mockUploadBuffer.mockReset();
  mockDistributeLeads.mockReset().mockResolvedValue({ id: "lead-1" });
  mockNotifyCustomer.mockReset().mockResolvedValue(undefined);
  mockRenderReportPDF.mockReset().mockResolvedValue(Buffer.from("fake-pdf"));
});

describe("runAnalysisPipeline — tag-indifference (SV-046 acceptance criterion)", () => {
  it("completes successfully when no photo has been tagged at all", async () => {
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{}, {}, {}]));

    const report = await runAnalysisPipeline("survey-1");

    expect(report).toEqual({ id: "report-1" });
    expect(mockSurveyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "complete" } })
    );
  });

  it("completes successfully with a mix of tagged and untagged photos", async () => {
    mockSurveyFindUnique.mockResolvedValue(
      makeSurvey([
        { roofPart: "front", captureMethod: "drone" },
        { roofPart: null },
        { roofPart: "chimney" },
      ])
    );

    const report = await runAnalysisPipeline("survey-1");
    expect(report).toEqual({ id: "report-1" });
  });

  it("completes successfully when every photo is tagged", async () => {
    mockSurveyFindUnique.mockResolvedValue(
      makeSurvey([
        { roofPart: "front" },
        { roofPart: "back" },
        { roofPart: "side" },
      ])
    );

    const report = await runAnalysisPipeline("survey-1");
    expect(report).toEqual({ id: "report-1" });
  });

  it("never passes tag data to analyzeRoof — that wiring is SV-048, not this ticket", async () => {
    mockSurveyFindUnique.mockResolvedValue(
      makeSurvey([{ roofPart: "front", captureMethod: "drone" }])
    );

    await runAnalysisPipeline("survey-1");

    const callArgs = mockAnalyzeRoof.mock.calls[0];
    const serialized = JSON.stringify(callArgs);
    expect(serialized).not.toContain("roofPart");
    expect(serialized).not.toContain("captureMethod");
  });

  it("marks the survey failed (not blocked pre-emptively) if the pipeline throws, regardless of tags", async () => {
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{ roofPart: "front" }]));
    mockAnalyzeRoof.mockRejectedValue(new Error("Claude is down"));

    await expect(runAnalysisPipeline("survey-1")).rejects.toThrow("Claude is down");
    expect(mockSurveyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "failed" } })
    );
  });
});
