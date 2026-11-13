import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockPropertyFindUnique = vi.fn();
const mockSurveyCreate = vi.fn();
const switches = { droneEnabled: false, rooferEnabled: false };

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { findUnique: (...args: unknown[]) => mockPropertyFindUnique(...args) },
    survey: {
      create: (...args: unknown[]) => mockSurveyCreate(...args),
      count: (...args: unknown[]) => mockSurveyCount(...args),
    },
  },
}));
vi.mock("@/lib/journeys", () => ({ journeys: switches }));
const mockSurveyCount = vi.fn();

const { POST } = await import("./route");

const PROPERTY_ID = "ckq1z2x3y0000a1b2c3d4e5f6";

function req(type: string, extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/surveys", {
    method: "POST",
    body: JSON.stringify({ propertyId: PROPERTY_ID, type, ...extra }),
  });
}

beforeEach(() => {
  switches.droneEnabled = false;
  mockSurveyCount.mockReset().mockResolvedValue(0);
  mockAuth.mockReset().mockResolvedValue({ user: { id: "cust-1", role: "customer" } });
  mockPropertyFindUnique.mockReset().mockResolvedValue({ id: PROPERTY_ID, ownerId: "cust-1" });
  mockSurveyCreate.mockReset().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "survey-1",
    ...data,
  }));
});

describe("POST /api/surveys with the drone journey off", () => {
  it("refuses drone_capture and creates no survey", async () => {
    const res = await POST(req("drone_capture"));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockSurveyCreate).not.toHaveBeenCalled();
  });

  it("accepts self_upload", async () => {
    const res = await POST(req("self_upload"));
    expect(res.status).toBe(201);
    expect(mockSurveyCreate).toHaveBeenCalledTimes(1);
    expect(mockSurveyCreate.mock.calls[0][0].data.type).toBe("self_upload");
  });
});

describe("POST /api/surveys with the drone journey on", () => {
  it("accepts drone_capture", async () => {
    switches.droneEnabled = true;
    const res = await POST(req("drone_capture"));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/surveys — limits (BL-066)", () => {
  it("refuses a sixth survey in 24 hours with 429 and creates nothing", async () => {
    mockSurveyCount.mockResolvedValue(5);
    const res = await POST(req("self_upload"));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/try again/i);
    expect(mockSurveyCreate).not.toHaveBeenCalled();
  });

  it("accepts the fifth survey", async () => {
    mockSurveyCount.mockResolvedValue(4);
    const res = await POST(req("self_upload"));
    expect(res.status).toBe(201);
  });

  it("limits an admin acting on their own account the same way", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    mockPropertyFindUnique.mockResolvedValue({ id: PROPERTY_ID, ownerId: "admin-1" });
    mockSurveyCount.mockResolvedValue(5);
    const res = await POST(req("self_upload"));
    expect(res.status).toBe(429);
    expect(mockSurveyCount.mock.calls[0][0].where.customerId).toBe("admin-1");
  });

  it("refuses notes over 2,000 characters", async () => {
    const res = await POST(req("self_upload", { notes: "x".repeat(2001) }));
    expect(res.status).toBe(400);
    expect(mockSurveyCreate).not.toHaveBeenCalled();
  });

  it("refuses notes that are not text", async () => {
    const res = await POST(req("self_upload", { notes: 42 }));
    expect(res.status).toBe(400);
  });

  it("accepts notes of exactly 2,000 characters", async () => {
    const res = await POST(req("self_upload", { notes: "x".repeat(2000) }));
    expect(res.status).toBe(201);
  });
});
