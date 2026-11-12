import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpload = vi.fn();
const mockRender = vi.fn();
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
vi.mock("@/lib/r2", () => ({
  generatePdfKey: (surveyId: string) => `surveys/${surveyId}/report.pdf`,
  uploadBuffer: (...args: unknown[]) => mockUpload(...args),
  downloadBuffer: vi.fn(),
}));
vi.mock("@/lib/pdf", () => ({ renderReportPDF: (...args: unknown[]) => mockRender(...args) }));
vi.mock("@/lib/resend", () => ({ notifyCustomerReportReady: (...args: unknown[]) => mockNotify(...args) }));
vi.mock("@/lib/surveyImages", () => ({
  fetchSurveyPhotos: vi.fn(async () => [{ base64: "AAAA", mimeType: "image/jpeg" }]),
}));

const { PATCH } = await import("./route");

const ADMIN = { user: { id: "admin-1", role: "admin" } };
const CUSTOMER = { user: { id: "cust-1", role: "customer" } };

const VALID = {
  conditionScore: 5,
  defects: [{ type: "ridge_damage", severity: "medium", description: "Cracked ridge tile", image_index: 0 }],
  recommendations: ["Re-bed the ridge"],
  adminNotes: null,
};

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/admin/reports/report-1", { method: "PATCH", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "report-1" }) }
  );
}

beforeEach(() => {
  mockAuth.mockReset().mockResolvedValue(ADMIN);
  mockUpdate.mockReset().mockResolvedValue({});
  mockUpload.mockReset().mockResolvedValue(undefined);
  mockRender.mockReset().mockResolvedValue(Buffer.from("pdf"));
  mockNotify.mockReset().mockResolvedValue(undefined);
  mockFindUnique.mockReset().mockResolvedValue({
    id: "report-1",
    surveyId: "survey-1",
    status: "draft",
    conditionScore: 7,
    defectsJson: [],
    recommendations: [],
    estimatedRemainingLife: 10,
    confidence: "high",
    rawAiResponse: { condition_score: 7, defects: [], recommendations: [] },
    adminNotes: null,
    pdfS3Key: "surveys/survey-1/report.pdf",
    survey: {
      notes: null,
      roofContext: null,
      property: { address: "1 Test St", postcode: "SW1A 1AA" },
      customer: { email: "jane@example.com", name: "Jane" },
      images: [],
    },
  });
});

describe("PATCH /api/admin/reports/[id]", () => {
  it.each([
    ["a customer", CUSTOMER],
    ["a signed-out caller", null],
  ])("refuses %s and changes nothing", async (_label, session) => {
    mockAuth.mockResolvedValue(session);
    const res = await patch(VALID);
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("refuses an invalid correction and changes nothing", async () => {
    const res = await patch({ ...VALID, conditionScore: 12 });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown report", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect((await patch(VALID)).status).toBe(404);
  });

  it("saves a valid correction, re-makes the PDF and sends no email", async () => {
    const res = await patch(VALID);
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalledWith("surveys/survey-1/report.pdf", Buffer.from("pdf"), "application/pdf");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "report-1" },
      data: expect.objectContaining({ conditionScore: 5, recommendations: ["Re-bed the ridge"] }),
    });
    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("rawAiResponse");
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
