import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockSurveyFindUnique = vi.fn();
const mockLeadFindUnique = vi.fn();
const mockLeadCreate = vi.fn();
const mockNotifyAdmin = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    survey: { findUnique: (...args: unknown[]) => mockSurveyFindUnique(...args) },
    lead: {
      findUnique: (...args: unknown[]) => mockLeadFindUnique(...args),
      create: (...args: unknown[]) => mockLeadCreate(...args),
    },
  },
}));
vi.mock("@/lib/resend", () => ({
  notifyAdminRooferRequest: (...args: unknown[]) => mockNotifyAdmin(...args),
}));

const { POST } = await import("./route");

const OWNER = { user: { id: "cust-1", role: "customer" } };
const CREATED_AT = new Date("2026-11-10T12:00:00Z");

function survey(report: { id: string; status: string } | null = { id: "report-1", status: "published" }) {
  return {
    id: "survey-1",
    customerId: "cust-1",
    property: { address: "1 Test St", postcode: "SW1A 1AA" },
    customer: { name: "Jane Smith", email: "jane@example.com" },
    report,
  };
}

function request(body: unknown) {
  return POST(
    new Request("http://localhost/api/surveys/survey-1/roofer-request", { method: "POST", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "survey-1" }) }
  );
}

beforeEach(() => {
  vi.unstubAllEnvs();
  mockAuth.mockReset().mockResolvedValue(OWNER);
  mockSurveyFindUnique.mockReset().mockResolvedValue(survey());
  mockLeadFindUnique.mockReset().mockResolvedValue(null);
  mockLeadCreate.mockReset().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "lead-1",
    status: "open",
    createdAt: CREATED_AT,
    ...data,
  }));
  mockNotifyAdmin.mockReset().mockResolvedValue(undefined);
});

function expectNothingRecorded() {
  expect(mockLeadCreate).not.toHaveBeenCalled();
  expect(mockNotifyAdmin).not.toHaveBeenCalled();
}

describe("POST /api/surveys/[id]/roofer-request", () => {
  it.each([[{}], [{ consent: false }], [{ consent: "yes" }]])("refuses a request without consent (%j)", async (body) => {
    const res = await request(body);
    expect(res.status).toBe(400);
    expectNothingRecorded();
  });

  it("records one open request with the postcode and emails the admin once", async () => {
    const before = Date.now();
    const res = await request({ consent: true });
    const consentedAt = mockLeadCreate.mock.calls[0][0].data.createdAt as Date;
    expect(consentedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(consentedAt.getTime()).toBeLessThanOrEqual(Date.now());

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: "open" });
    expect(mockLeadCreate).toHaveBeenCalledTimes(1);
    expect(mockLeadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          surveyId: "survey-1",
          reportId: "report-1",
          postcode: "SW1A 1AA",
          status: "open",
          createdAt: expect.any(Date),
        },
      })
    );
    expect(mockNotifyAdmin).toHaveBeenCalledTimes(1);
    expect(mockNotifyAdmin).toHaveBeenCalledWith({
      to: "dan@skyvaultuk.com",
      customerName: "Jane Smith",
      customerEmail: "jane@example.com",
      address: "1 Test St",
      postcode: "SW1A 1AA",
      surveyId: "survey-1",
    });
  });

  it("sends the admin email to the configured address when one is set", async () => {
    vi.stubEnv("SKYVAULT_ADMIN_EMAIL", "ops@skyvault.test");
    await request({ consent: true });
    expect(mockNotifyAdmin.mock.calls[0][0].to).toBe("ops@skyvault.test");
  });

  it("answers a repeat with the existing request, creating nothing and sending nothing", async () => {
    mockLeadFindUnique.mockResolvedValue({ id: "lead-1", status: "open", createdAt: CREATED_AT });
    const res = await request({ consent: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "open" });
    expectNothingRecorded();
  });

  it("still records the request when the admin email fails", async () => {
    mockNotifyAdmin.mockRejectedValue(new Error("email transport down"));
    const res = await request({ consent: true });
    expect(res.status).toBe(201);
    expect(mockLeadCreate).toHaveBeenCalledTimes(1);
  });

  it("refuses a signed-out caller", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await request({ consent: true })).status).toBe(401);
    expectNothingRecorded();
  });

  it("refuses another customer", async () => {
    mockAuth.mockResolvedValue({ user: { id: "cust-2", role: "customer" } });
    expect((await request({ consent: true })).status).toBe(404);
    expectNothingRecorded();
  });

  it("refuses a survey with no report", async () => {
    mockSurveyFindUnique.mockResolvedValue(survey(null));
    expect((await request({ consent: true })).status).toBe(409);
    expectNothingRecorded();
  });

  it("refuses a held report", async () => {
    mockSurveyFindUnique.mockResolvedValue(survey({ id: "report-1", status: "draft" }));
    expect((await request({ consent: true })).status).toBe(409);
    expectNothingRecorded();
  });
});
