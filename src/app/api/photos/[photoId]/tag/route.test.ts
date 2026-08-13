import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    image: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

const { PATCH, DELETE } = await import("./route");

const CUSTOMER_SESSION = { user: { id: "cust-1", role: "customer" } };
const OTHER_CUSTOMER_SESSION = { user: { id: "cust-2", role: "customer" } };
const DRONE_SESSION = { user: { id: "drone-1", role: "drone" } };
const ADMIN_SESSION = { user: { id: "admin-1", role: "admin" } };

function makeImage(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "photo-1",
    roofParts: [],
    aspect: null,
    captureMethod: null,
    taggedAt: null,
    survey: {
      customerId: "cust-1",
      droneJob: { operatorId: "drone-1" },
    },
    ...overrides,
  };
}

function req(body: unknown) {
  return new Request("http://localhost/api/photos/photo-1/tag", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function params() {
  return { params: Promise.resolve({ photoId: "photo-1" }) };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
});

describe("PATCH /api/photos/[photoId]/tag", () => {
  it("401s when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(req({ roofParts: ["front"] }), params());
    expect(res.status).toBe(401);
  });

  it("404s when the photo doesn't exist", async () => {
    mockAuth.mockResolvedValue(CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(null);
    const res = await PATCH(req({ roofParts: ["front"] }), params());
    expect(res.status).toBe(404);
  });

  it("403s for a customer who doesn't own the survey", async () => {
    mockAuth.mockResolvedValue(OTHER_CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(makeImage());
    const res = await PATCH(req({ roofParts: ["front"] }), params());
    expect(res.status).toBe(403);
  });

  it("403s for a drone operator not assigned to this job", async () => {
    mockAuth.mockResolvedValue({ user: { id: "drone-2", role: "drone" } });
    mockFindUnique.mockResolvedValue(makeImage());
    const res = await PATCH(req({ roofParts: ["front"] }), params());
    expect(res.status).toBe(403);
  });

  it("rejects an invalid roofParts value and never calls update", async () => {
    mockAuth.mockResolvedValue(CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(makeImage());
    const res = await PATCH(req({ roofParts: ["attic"] }), params());
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a request missing roofParts entirely", async () => {
    mockAuth.mockResolvedValue(CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(makeImage());
    const res = await PATCH(req({}), params());
    expect(res.status).toBe(400);
  });

  it("persists a single tag for the owning customer and stamps taggedAt", async () => {
    mockAuth.mockResolvedValue(CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(makeImage());
    mockUpdate.mockResolvedValue(makeImage({ roofParts: ["chimney"], taggedAt: new Date("2026-07-01") }));

    const res = await PATCH(req({ roofParts: ["chimney"] }), params());
    expect(res.status).toBe(200);

    const call = mockUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ id: "photo-1" });
    expect(call.data.roofParts).toEqual(["chimney"]);
    expect(call.data.taggedAt).toBeInstanceOf(Date);

    const body = await res.json();
    expect(body).toEqual({
      photoId: "photo-1",
      roofParts: ["chimney"],
      aspect: null,
      captureMethod: null,
      taggedAt: "2026-07-01T00:00:00.000Z",
    });
  });

  it("persists multiple roof parts on the same photo", async () => {
    mockAuth.mockResolvedValue(CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(makeImage());
    mockUpdate.mockResolvedValue(makeImage({ roofParts: ["front", "chimney"] }));

    const res = await PATCH(req({ roofParts: ["front", "chimney"] }), params());
    expect(res.status).toBe(200);

    const call = mockUpdate.mock.calls[0][0];
    expect(call.data.roofParts).toEqual(["front", "chimney"]);
  });

  it("persists an aspect independently of roofParts and stamps taggedAt", async () => {
    mockAuth.mockResolvedValue(CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(makeImage());
    mockUpdate.mockResolvedValue(makeImage({ roofParts: [], aspect: "north", taggedAt: new Date() }));

    const res = await PATCH(req({ roofParts: [], aspect: "north" }), params());
    expect(res.status).toBe(200);

    const call = mockUpdate.mock.calls[0][0];
    expect(call.data.roofParts).toEqual([]);
    expect(call.data.aspect).toBe("north");
    expect(call.data.taggedAt).toBeInstanceOf(Date);
  });

  it("allows the assigned drone operator to tag", async () => {
    mockAuth.mockResolvedValue(DRONE_SESSION);
    mockFindUnique.mockResolvedValue(makeImage({ survey: { customerId: "cust-1", droneJob: { operatorId: "drone-1" } } }));
    mockUpdate.mockResolvedValue(makeImage({ roofParts: ["side"] }));

    const res = await PATCH(req({ roofParts: ["side"] }), params());
    expect(res.status).toBe(200);
  });

  it("allows admin regardless of ownership", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(makeImage());
    mockUpdate.mockResolvedValue(makeImage({ roofParts: ["back"] }));

    const res = await PATCH(req({ roofParts: ["back"] }), params());
    expect(res.status).toBe(200);
  });

  it("untags via roofParts: [] with no aspect and clears taggedAt", async () => {
    mockAuth.mockResolvedValue(CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(makeImage({ roofParts: ["front"], taggedAt: new Date() }));
    mockUpdate.mockResolvedValue(makeImage({ roofParts: [], aspect: null, taggedAt: null }));

    const res = await PATCH(req({ roofParts: [] }), params());
    expect(res.status).toBe(200);

    const call = mockUpdate.mock.calls[0][0];
    expect(call.data.roofParts).toEqual([]);
    expect(call.data.taggedAt).toBeNull();
  });

  it("keeps taggedAt set if aspect alone remains even with roofParts cleared", async () => {
    mockAuth.mockResolvedValue(CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(makeImage({ roofParts: ["front"], aspect: "east" }));
    mockUpdate.mockResolvedValue(makeImage({ roofParts: [], aspect: "east", taggedAt: new Date() }));

    const res = await PATCH(req({ roofParts: [], aspect: "east" }), params());
    expect(res.status).toBe(200);

    const call = mockUpdate.mock.calls[0][0];
    expect(call.data.taggedAt).toBeInstanceOf(Date);
  });

  it("is idempotent — tagging the same value twice yields the same persisted state", async () => {
    mockAuth.mockResolvedValue(CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(makeImage());
    mockUpdate.mockResolvedValue(makeImage({ roofParts: ["front"] }));

    await PATCH(req({ roofParts: ["front"] }), params());
    await PATCH(req({ roofParts: ["front"] }), params());

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate.mock.calls[0][0].data.roofParts).toEqual(["front"]);
    expect(mockUpdate.mock.calls[1][0].data.roofParts).toEqual(["front"]);
  });
});

describe("DELETE /api/photos/[photoId]/tag", () => {
  it("clears roofParts, aspect, captureMethod, and taggedAt", async () => {
    mockAuth.mockResolvedValue(CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(makeImage({ roofParts: ["front"], aspect: "north", captureMethod: "drone", taggedAt: new Date() }));
    mockUpdate.mockResolvedValue(makeImage({ roofParts: [], aspect: null, captureMethod: null, taggedAt: null }));

    const res = await DELETE(new Request("http://localhost/api/photos/photo-1/tag", { method: "DELETE" }), params());
    expect(res.status).toBe(200);

    const call = mockUpdate.mock.calls[0][0];
    expect(call.data).toEqual({ roofParts: [], aspect: null, captureMethod: null, taggedAt: null });
  });

  it("403s for an unrelated customer", async () => {
    mockAuth.mockResolvedValue(OTHER_CUSTOMER_SESSION);
    mockFindUnique.mockResolvedValue(makeImage());
    const res = await DELETE(new Request("http://localhost/api/photos/photo-1/tag", { method: "DELETE" }), params());
    expect(res.status).toBe(403);
  });
});
