import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

const { PATCH } = await import("./route");

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/admin/roofer-requests/lead-1", { method: "PATCH", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "lead-1" }) }
  );
}

beforeEach(() => {
  mockAuth.mockReset().mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  mockFindUnique.mockReset().mockResolvedValue({ id: "lead-1", status: "open" });
  mockUpdate.mockReset().mockResolvedValue({ id: "lead-1", status: "closed" });
});

describe("PATCH /api/admin/roofer-requests/[id]", () => {
  it("lets an admin mark a request handled", async () => {
    const res = await patch({ status: "closed" });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { status: "closed" } });
  });

  it.each([
    ["a customer", { user: { id: "cust-1", role: "customer" } }],
    ["a signed-out caller", null],
  ])("refuses %s and changes nothing", async (_label, session) => {
    mockAuth.mockResolvedValue(session);
    expect((await patch({ status: "closed" })).status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it.each([[{}], [{ status: "open" }], [{ status: "deleted" }]])("refuses a bad body %j", async (body) => {
    expect((await patch(body)).status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown request", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect((await patch({ status: "closed" })).status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
