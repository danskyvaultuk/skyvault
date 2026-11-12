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

const ADMIN = { user: { id: "admin-1", role: "admin" } };
const CUSTOMER = { user: { id: "cust-1", role: "customer" } };

function heldReport(status: "draft" | "published" | "overridden" = "draft") {
  return {
    id: "report-1",
    surveyId: "survey-1",
    status,
    conditionScore: 7,
    defectsJson: [],
    recommendations: ["Clear the gutters"],
    estimatedRemainingLife: 10,
    confidence: "high",
    rawAiResponse: { condition_score: 7, defects: [], recommendations: ["Clear the gutters"] },
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

function approve() {
  return POST(new Request("http://localhost/api/admin/reports/report-1/approve", { method: "POST" }), {
    params: Promise.resolve({ id: "report-1" }),
  });
}

beforeEach(() => {
  mockAuth.mockReset().mockResolvedValue(ADMIN);
  mockFindUnique.mockReset().mockResolvedValue(heldReport());
  mockUpdate.mockReset().mockResolvedValue({});
  mockNotify.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/admin/reports/[id]/approve", () => {
  it.each([
    ["a customer", CUSTOMER],
    ["a signed-out caller", null],
  ])("refuses %s, releases nothing and sends no email", async (_label, session) => {
    mockAuth.mockResolvedValue(session);
    expect((await approve()).status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("releases a held report and emails the customer once", async () => {
    const res = await approve();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "published" });
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: "report-1" }, data: { status: "published" } });
    expect(mockNotify).toHaveBeenCalledTimes(1);
    // BL-022: the stored PDF goes with the email.
    expect(mockNotify.mock.calls[0][0]).toMatchObject({ pdf: STORED_PDF, postcode: "SW1A 1AA" });
  });

  it("refuses an already released report with 409 and sends no email", async () => {
    mockFindUnique.mockResolvedValue(heldReport("published"));
    expect((await approve()).status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown report", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect((await approve()).status).toBe(404);
  });
});
