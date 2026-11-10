import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockPropertyFindUnique = vi.fn();
const mockSurveyCreate = vi.fn();
const switches = { droneEnabled: false, rooferEnabled: false };

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { findUnique: (...args: unknown[]) => mockPropertyFindUnique(...args) },
    survey: { create: (...args: unknown[]) => mockSurveyCreate(...args) },
  },
}));
vi.mock("@/lib/journeys", () => ({ journeys: switches }));

const { POST } = await import("./route");

const PROPERTY_ID = "ckq1z2x3y0000a1b2c3d4e5f6";

function req(type: string) {
  return new Request("http://localhost/api/surveys", {
    method: "POST",
    body: JSON.stringify({ propertyId: PROPERTY_ID, type }),
  });
}

beforeEach(() => {
  switches.droneEnabled = false;
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
