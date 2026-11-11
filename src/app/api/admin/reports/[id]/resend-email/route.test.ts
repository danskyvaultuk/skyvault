import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    report: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));
const STORED_PDF = Buffer.from("%PDF stored");
vi.mock("@/lib/r2", () => ({
  generatePdfKey: vi.fn(),
  uploadBuffer: vi.fn(),
  downloadBuffer: vi.fn(async () => STORED_PDF),
}));
vi.mock("@/lib/pdf", () => ({ renderReportPDF: vi.fn() }));
vi.mock("@/lib/resend", () => ({ notifyCustomerReportReady: (...args: unknown[]) => mockNotify(...args) }));
vi.mock("@/lib/surveyImages", () => ({ fetchSurveyPhotos: vi.fn() }));

const { POST } = await import("./route");

function report(status: "draft" | "published" | "overridden") {
  return {
    id: "report-1",
    surveyId: "survey-1",
    status,
    conditionScore: 7,
    defectsJson: [],
    recommendations: [],
    estimatedRemainingLife: 10,
    confidence: "high",
    rawAiResponse: {},
    adminNotes: null,
    pdfS3Key: "surveys/survey-1/report.pdf",
    survey: {
      notes: null,
      roofContext: null,
      property: { address: "1 Test St", postcode: "SW1A 1AA" },
      customer: { email: "jane@example.com", name: "Jane" },
      images: [],
    },
  };
}

function resend() {
  return POST(new Request("http://localhost/api/admin/reports/report-1/resend-email", { method: "POST" }), {
    params: Promise.resolve({ id: "report-1" }),
  });
}

beforeEach(() => {
  mockAuth.mockReset().mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  mockFindUnique.mockReset().mockResolvedValue(report("published"));
  mockUpdate.mockReset();
  mockNotify.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/admin/reports/[id]/resend-email", () => {
  it.each([
    ["a customer", { user: { id: "cust-1", role: "customer" } }],
    ["a signed-out caller", null],
  ])("refuses %s and sends no email", async (_label, session) => {
    mockAuth.mockResolvedValue(session);
    expect((await resend()).status).toBe(403);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("re-sends the email once for a released report and changes nothing", async () => {
    const res = await resend();
    expect(res.status).toBe(200);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    // BL-022: the stored PDF goes with the email.
    expect(mockNotify.mock.calls[0][0]).toMatchObject({ pdf: STORED_PDF, postcode: "SW1A 1AA" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuses a held report with 409 and sends no email", async () => {
    mockFindUnique.mockResolvedValue(report("draft"));
    expect((await resend()).status).toBe(409);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown report", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect((await resend()).status).toBe(404);
  });
});
