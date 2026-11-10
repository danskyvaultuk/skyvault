import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockSurveyFindUnique = vi.fn();
const mockImageCreate = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    survey: { findUnique: (...args: unknown[]) => mockSurveyFindUnique(...args) },
    image: { create: (...args: unknown[]) => mockImageCreate(...args) },
  },
}));

const { POST } = await import("./route");

function register(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/surveys/survey-1/images", {
      method: "POST",
      body: JSON.stringify({ s3Key: "surveys/survey-1/images/a.jpg", originalFilename: "a.jpg", ...body }),
    }),
    { params: Promise.resolve({ id: "survey-1" }) }
  );
}

beforeEach(() => {
  mockAuth.mockReset().mockResolvedValue({ user: { id: "cust-1", role: "customer" } });
  mockSurveyFindUnique.mockReset().mockResolvedValue({ id: "survey-1", customerId: "cust-1", droneJob: null, _count: { images: 2 } });
  mockImageCreate.mockReset().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "img-1", ...data }));
});

describe("POST /api/surveys/[id]/images — checklist labels (BL-021)", () => {
  it("saves the checklist item's roof parts with a tagged time", async () => {
    const res = await register({ roofParts: ["chimney", "flashing"] });
    expect(res.status).toBe(201);
    const data = mockImageCreate.mock.calls[0][0].data;
    expect(data.roofParts).toEqual(["chimney", "flashing"]);
    expect(data.taggedAt).toBeInstanceOf(Date);
    expect(data.sortOrder).toBe(2);
  });

  it("refuses an unknown roof part and saves nothing", async () => {
    const res = await register({ roofParts: ["front", "attic"] });
    expect(res.status).toBe(400);
    expect(mockImageCreate).not.toHaveBeenCalled();
  });

  it("saves no roof parts when none are sent, as before", async () => {
    const res = await register({});
    expect(res.status).toBe(201);
    const data = mockImageCreate.mock.calls[0][0].data;
    expect(data.roofParts ?? []).toEqual([]);
    expect(data.taggedAt ?? null).toBeNull();
  });
});
