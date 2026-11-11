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

const mockAssess = vi.fn();
vi.mock("@/lib/r2", () => ({ getPresignedReadUrl: vi.fn(async () => "https://storage.test/signed") }));
vi.mock("@/lib/photoQuality", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/photoQuality")>()),
  assessPhotoQuality: (...args: unknown[]) => mockAssess(...args),
}));

const { POST } = await import("./route");

const ACCEPTED = { outcome: "accepted", width: 4032, height: 3024, sharpness: 312.5 };
const mockFetch = vi.fn();

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
  mockFetch.mockReset().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  vi.stubGlobal("fetch", mockFetch);
  mockAssess.mockReset().mockResolvedValue(ACCEPTED);
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

describe("POST /api/surveys/[id]/images — photo quality (BL-018)", () => {
  it.each([
    ["too-blurry", { outcome: "rejected", reason: "too-blurry", width: 4032, height: 3024, sharpness: 3.1 }],
    ["too-small", { outcome: "rejected", reason: "too-small", width: 640, height: 480, sharpness: 200 }],
    ["unreadable", { outcome: "rejected", reason: "unreadable" }],
  ])("rejects a %s photo with 422 and guidance, saves nothing, and logs it", async (reason, assessment) => {
    mockAssess.mockResolvedValue(assessment);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await register({});

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.reason).toBe(reason);
    expect(body.guidance.length).toBeGreaterThan(20);
    expect(mockImageCreate).not.toHaveBeenCalled();
    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("[photo-quality] rejected");
    expect(logged).toContain("survey-1");
    expect(logged).toContain(reason);
    expect(logged).toContain("minSharpness");
    warn.mockRestore();
  });

  it("saves an accepted photo as valid with its measurements", async () => {
    const res = await register({});
    expect(res.status).toBe(201);
    const data = mockImageCreate.mock.calls[0][0].data;
    expect(data.validationStatus).toBe("valid");
    expect(data.validationNotes).toContain("4032x3024");
    expect(data.validationNotes).toContain("312.5");
  });

  it("saves the photo unchecked (pending) when storage cannot be read, and logs it", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await register({});

    expect(res.status).toBe(201);
    expect(mockImageCreate.mock.calls[0][0].data.validationStatus).toBe("pending");
    expect(mockAssess).not.toHaveBeenCalled();
    expect(error.mock.calls.map((c) => String(c[0])).join("\n")).toContain("[photo-quality] could not read");
    error.mockRestore();
  });

  it("checks the photo only after the caller is allowed to add it", async () => {
    mockAuth.mockResolvedValue({ user: { id: "cust-2", role: "customer" } });
    const res = await register({});
    expect(res.status).toBe(403);
    expect(mockAssess).not.toHaveBeenCalled();
  });
});
