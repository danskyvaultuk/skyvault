import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockSurveyFindUnique = vi.fn();
const mockSurveyUpdate = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    survey: {
      findUnique: (...args: unknown[]) => mockSurveyFindUnique(...args),
      update: (...args: unknown[]) => mockSurveyUpdate(...args),
    },
  },
}));
vi.mock("@/lib/r2", () => ({
  getPresignedReadUrl: vi.fn(async () => "https://example.com/signed"),
}));

const { GET, PATCH } = await import("./route");

const OWNER = { user: { id: "cust-1", role: "customer" } };
const ADMIN = { user: { id: "admin-1", role: "admin" } };

function makeSurvey(reportStatus: "draft" | "published" | "overridden") {
  return {
    id: "survey-1",
    customerId: "cust-1",
    status: "complete",
    images: [],
    droneJob: null,
    report: {
      id: "report-1",
      status: reportStatus,
      conditionScore: 4,
      defectsJson: [{ type: "other", severity: "high", description: "Slipped slates", image_index: 0 }],
      recommendations: ["Replace slipped slates"],
      pdfS3Key: "surveys/survey-1/report.pdf",
      adminNotes: "Score lowered from 6",
    },
  };
}

async function getReport(session: unknown, reportStatus: "draft" | "published" | "overridden") {
  mockAuth.mockResolvedValue(session);
  mockSurveyFindUnique.mockResolvedValue(makeSurvey(reportStatus));
  const res = await GET(new Request("http://localhost/api/surveys/survey-1"), {
    params: Promise.resolve({ id: "survey-1" }),
  });
  expect(res.status).toBe(200);
  return (await res.json()).report as Record<string, unknown>;
}

beforeEach(() => {
  mockAuth.mockReset();
  mockSurveyFindUnique.mockReset();
});

describe("GET /api/surveys/[id] — held reports (BL-061)", () => {
  it("withholds a held report's contents and admin notes from the owner", async () => {
    const report = await getReport(OWNER, "draft");
    expect(report).toEqual({ id: "report-1", status: "draft" });
    for (const key of ["conditionScore", "defectsJson", "recommendations", "pdfS3Key", "adminNotes"]) {
      expect(report).not.toHaveProperty(key);
    }
  });

  it("returns a held report in full to an admin", async () => {
    const report = await getReport(ADMIN, "draft");
    expect(report).toMatchObject({ conditionScore: 4, pdfS3Key: "surveys/survey-1/report.pdf", adminNotes: "Score lowered from 6" });
  });

  it.each(["published", "overridden"] as const)(
    "returns a %s report to the owner without the admin notes",
    async (status) => {
      const report = await getReport(OWNER, status);
      expect(report).toMatchObject({ conditionScore: 4, recommendations: ["Replace slipped slates"] });
      expect(report).not.toHaveProperty("adminNotes");
    }
  );
});

describe("PATCH /api/surveys/[id] — notes (BL-066)", () => {
  function patch(body: Record<string, unknown>, status = "draft") {
    mockAuth.mockResolvedValue(OWNER);
    mockSurveyFindUnique.mockResolvedValue({ id: "survey-1", customerId: "cust-1", status });
    mockSurveyUpdate.mockReset().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "survey-1", ...data }));
    return PATCH(new Request("http://localhost/api/surveys/survey-1", { method: "PATCH", body: JSON.stringify(body) }), {
      params: Promise.resolve({ id: "survey-1" }),
    });
  }

  it("refuses notes over 2,000 characters and saves nothing", async () => {
    const res = await patch({ notes: "x".repeat(2001) });
    expect(res.status).toBe(400);
    expect(mockSurveyUpdate).not.toHaveBeenCalled();
  });

  it("refuses notes that are not text", async () => {
    const res = await patch({ notes: { text: "hi" } });
    expect(res.status).toBe(400);
    expect(mockSurveyUpdate).not.toHaveBeenCalled();
  });

  it("refuses invalid notes on a survey past draft too", async () => {
    const res = await patch({ notes: "x".repeat(2001) }, "complete");
    expect(res.status).toBe(400);
    expect(mockSurveyUpdate).not.toHaveBeenCalled();
  });

  it("saves notes of exactly 2,000 characters", async () => {
    const res = await patch({ notes: "x".repeat(2000) });
    expect(res.status).toBe(200);
    expect(mockSurveyUpdate.mock.calls[0][0].data.notes).toHaveLength(2000);
  });
});

describe("PATCH /api/surveys/[id] — retrying an analysis that stopped (BL-066)", () => {
  const MINUTE = 60 * 1000;
  function reset(updatedAt: Date) {
    mockAuth.mockResolvedValue(OWNER);
    mockSurveyFindUnique.mockResolvedValue({ id: "survey-1", customerId: "cust-1", status: "analysing", updatedAt });
    mockSurveyUpdate.mockReset().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "survey-1", ...data }));
    return PATCH(new Request("http://localhost/api/surveys/survey-1", { method: "PATCH", body: JSON.stringify({ status: "draft" }) }), {
      params: Promise.resolve({ id: "survey-1" }),
    });
  }

  it("resets a survey analysing for over 10 minutes to draft", async () => {
    await reset(new Date(Date.now() - 11 * MINUTE));
    expect(mockSurveyUpdate.mock.calls[0][0].data.status).toBe("draft");
  });

  it("does not reset a survey analysing for under 10 minutes", async () => {
    await reset(new Date(Date.now() - 9 * MINUTE));
    expect(mockSurveyUpdate.mock.calls[0][0].data.status).toBeUndefined();
  });
});
