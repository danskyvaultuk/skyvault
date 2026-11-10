import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockSurveyFindUnique = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { survey: { findUnique: (...args: unknown[]) => mockSurveyFindUnique(...args) } },
}));
vi.mock("@/lib/r2", () => ({
  getPresignedReadUrl: vi.fn(async () => "https://example.com/signed"),
}));

const { GET } = await import("./route");

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
