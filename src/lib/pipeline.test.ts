import { describe, it, expect, vi, beforeEach } from "vitest";

// This test exists specifically to lock in an SV-046 acceptance criterion:
// tagging (or skipping it) must never affect report generation. SV-048 (not
// built yet) is the ticket that will make the pipeline actually *read* tags —
// until then, this test proves the pipeline is fully indifferent to their
// presence, value, or absence. It also covers the report-content addition
// (customer notes + roof Q&A now flow into the PDF).

const mockSurveyFindUnique = vi.fn();
const mockSurveyUpdate = vi.fn();
const mockReportCreate = vi.fn();
const mockAnalyzeRoof = vi.fn();
const mockUploadBuffer = vi.fn();
const mockDistributeLeads = vi.fn();
const mockNotifyCustomer = vi.fn();
const mockRenderReportPDF = vi.fn();
const switches = { droneEnabled: false, rooferEnabled: false };
// Reports kept only when the transaction that wrote them finishes (BL-066).
const committedReports: unknown[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    survey: {
      findUnique: (...args: unknown[]) => mockSurveyFindUnique(...args),
      update: (...args: unknown[]) => mockSurveyUpdate(...args),
    },
    report: {
      create: (...args: unknown[]) => mockReportCreate(...args),
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      const pending: unknown[] = [];
      const tx = {
        report: {
          create: async (...args: unknown[]) => {
            const created = await mockReportCreate(...args);
            pending.push(created);
            return created;
          },
        },
        survey: { update: (...args: unknown[]) => mockSurveyUpdate(...args) },
      };
      const result = await work(tx);
      committedReports.push(...pending);
      return result;
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

vi.mock("@/lib/journeys", () => ({ journeys: switches }));

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
  review_flags: [],
};

function makeSurvey(
  images: Array<Partial<Record<string, unknown>>>,
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "survey-1",
    notes: null,
    roofContext: null,
    property: { address: "1 Test St", postcode: "SW1A 1AA" },
    customer: { email: "a@b.com", name: "Test" },
    images: images.map((img, i) => ({
      id: `img-${i}`,
      s3Key: `surveys/survey-1/images/${i}.jpg`,
      originalFilename: `${i}.jpg`,
      sortOrder: i,
      roofParts: [],
      aspect: null,
      captureMethod: null,
      taggedAt: null,
      ...img,
    })),
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  );
  committedReports.length = 0;
  mockSurveyFindUnique.mockReset();
  mockSurveyUpdate.mockReset().mockResolvedValue({});
  mockReportCreate.mockReset().mockResolvedValue({ id: "report-1" });
  mockAnalyzeRoof.mockReset().mockResolvedValue(VALID_ANALYSIS);
  mockUploadBuffer.mockReset();
  mockDistributeLeads.mockReset().mockResolvedValue({ id: "lead-1" });
  switches.rooferEnabled = false;
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

  it("completes successfully with a mix of tagged and untagged photos, single and multi-tagged", async () => {
    mockSurveyFindUnique.mockResolvedValue(
      makeSurvey([
        { roofParts: ["front"], captureMethod: "drone" },
        { roofParts: [] },
        { roofParts: ["chimney", "close_up"], aspect: "north" },
      ])
    );

    const report = await runAnalysisPipeline("survey-1");
    expect(report).toEqual({ id: "report-1" });
  });

  it("completes successfully when every photo is tagged", async () => {
    mockSurveyFindUnique.mockResolvedValue(
      makeSurvey([
        { roofParts: ["front"] },
        { roofParts: ["back"] },
        { roofParts: ["side", "ridge"], aspect: "south" },
      ])
    );

    const report = await runAnalysisPipeline("survey-1");
    expect(report).toEqual({ id: "report-1" });
  });

  // BL-021 (the SV-048 wiring): each photo's roof parts now reach the analysis,
  // in photo order, so the AI knows which photo shows which part of the roof.
  // The aspect and capture method are still not sent.
  it("passes each photo's roof parts to analyzeRoof in photo order", async () => {
    mockSurveyFindUnique.mockResolvedValue(
      makeSurvey([{ roofParts: ["front"], aspect: "north", captureMethod: "drone" }, {}, { roofParts: ["ridge", "chimney"] }])
    );

    await runAnalysisPipeline("survey-1");

    const callArgs = mockAnalyzeRoof.mock.calls[0];
    expect(callArgs[4]).toEqual([["front"], [], ["ridge", "chimney"]]);
    const serialized = JSON.stringify(callArgs);
    expect(serialized).not.toContain("north");
    expect(serialized).not.toContain("captureMethod");
  });

  it("marks the survey failed (not blocked pre-emptively) if the pipeline throws, regardless of tags", async () => {
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{ roofParts: ["front"] }]));
    mockAnalyzeRoof.mockRejectedValue(new Error("Claude is down"));

    await expect(runAnalysisPipeline("survey-1")).rejects.toThrow("Claude is down");
    expect(mockSurveyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "failed" } })
    );
  });
});

describe("runAnalysisPipeline — customer notes & roof Q&A reach the PDF", () => {
  it("passes survey.notes and the validated roofContext into renderReportPDF", async () => {
    mockSurveyFindUnique.mockResolvedValue(
      makeSurvey([{}], {
        notes: "Worried about the chimney flashing.",
        roofContext: { material: "slate", ageBand: "15+" },
      })
    );

    await runAnalysisPipeline("survey-1");

    const call = mockRenderReportPDF.mock.calls[0];
    // (analysis, address, postcode, imageBase64s, customerNotes, roofContext)
    expect(call[4]).toBe("Worried about the chimney flashing.");
    expect(call[5]).toEqual({ material: "slate", ageBand: "15+" });
  });

  it("passes null/undefined through cleanly when nothing was answered", async () => {
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{}], { notes: null, roofContext: null }));

    await runAnalysisPipeline("survey-1");

    const call = mockRenderReportPDF.mock.calls[0];
    expect(call[4]).toBeNull();
    expect(call[5]).toBeNull();
  });
});

describe("runAnalysisPipeline — lead distribution follows the roofer journey (BL-058)", () => {
  it("does not distribute leads while the roofer journey is off, and still completes the report", async () => {
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{}]));

    const report = await runAnalysisPipeline("survey-1");

    expect(report).toEqual({ id: "report-1" });
    expect(mockDistributeLeads).not.toHaveBeenCalled();
    expect(mockSurveyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "complete" }) })
    );
  });

  it("distributes leads while the roofer journey is on", async () => {
    switches.rooferEnabled = true;
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{}]));

    await runAnalysisPipeline("survey-1");

    expect(mockDistributeLeads).toHaveBeenCalledWith("survey-1", "report-1", "SW1A 1AA");
  });
});

describe("runAnalysisPipeline — every report is held for admin review (BL-061)", () => {
  it("saves the report held (draft) and does not email the customer", async () => {
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{}]));

    await runAnalysisPipeline("survey-1");

    expect(mockReportCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "draft" }) })
    );
    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });
});

describe("runAnalysisPipeline — priorities, locations and score caps (BL-003 / BL-009)", () => {
  it("passes each photo's roof parts to the PDF so locations name the customer's labels", async () => {
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{ roofParts: ["front"] }, {}]));
    await runAnalysisPipeline("survey-1");
    expect(mockRenderReportPDF.mock.calls[0][6]).toEqual([["front"], []]);
  });

  it("stores a capped score as both the report's score and the stored AI answer's score, keeping the AI's own", async () => {
    mockAnalyzeRoof.mockResolvedValue({ ...VALID_ANALYSIS, condition_score: 3, ai_condition_score: 8 });
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{}]));

    await runAnalysisPipeline("survey-1");

    const data = mockReportCreate.mock.calls[0][0].data;
    expect(data.conditionScore).toBe(3);
    expect(data.rawAiResponse).toMatchObject({ condition_score: 3, ai_condition_score: 8 });
  });
});

describe("runAnalysisPipeline — recorded timing (BL-023 / SPEC-015 C)", () => {
  it("stores the model and both times with the AI's answer, and logs them", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{}]));

    await runAnalysisPipeline("survey-1");

    const meta = mockReportCreate.mock.calls[0][0].data.rawAiResponse.analysis_meta;
    expect(meta.model).toBe("claude-opus-5-5");
    expect(Number.isInteger(meta.ai_ms) && meta.ai_ms >= 0).toBe(true);
    expect(Number.isInteger(meta.total_ms) && meta.total_ms >= meta.ai_ms).toBe(true);
    const timingLine = log.mock.calls.map((c) => String(c[0])).find((l) => l.includes("[pipeline] timing"));
    expect(timingLine).toMatch(/survey=survey-1 model=claude-opus-5-5 ai_ms=\d+ total_ms=\d+/);
    log.mockRestore();
  });

  it("keeps the AI's own answer fields beside the timing", async () => {
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{}]));
    await runAnalysisPipeline("survey-1");
    expect(mockReportCreate.mock.calls[0][0].data.rawAiResponse).toMatchObject({ condition_score: 8, confidence: "high" });
  });
});

describe("runAnalysisPipeline — report and completion saved together (BL-066 / SPEC-021 E1)", () => {
  it("keeps the report and marks the survey complete in one transaction", async () => {
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{}]));
    await runAnalysisPipeline("survey-1");
    expect(committedReports).toEqual([{ id: "report-1" }]);
    expect(mockSurveyUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "complete" } }));
  });

  it("leaves no report when marking the survey complete fails, and marks it failed", async () => {
    mockSurveyFindUnique.mockResolvedValue(makeSurvey([{}]));
    mockSurveyUpdate.mockImplementation(async ({ data }: { data: { status: string } }) => {
      if (data.status === "complete") throw new Error("write failed");
      return {};
    });

    await expect(runAnalysisPipeline("survey-1")).rejects.toThrow("write failed");
    expect(committedReports).toEqual([]);
    expect(mockSurveyUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: { status: "failed" } }));
  });
});
