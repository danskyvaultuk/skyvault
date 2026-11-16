import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: (...a: unknown[]) => mockUpdate(...a) } } }));

const { PATCH } = await import("./route");

const send = (body: unknown) =>
  PATCH(new Request("http://localhost/api/account/name", { method: "PATCH", body: JSON.stringify(body) }));

beforeEach(() => {
  mockAuth.mockReset().mockResolvedValue({ user: { id: "u1", role: "customer" } });
  mockUpdate.mockReset().mockResolvedValue({});
});

describe("PATCH /api/account/name (BL-081 / SPEC-030 B2, B4)", () => {
  it("B2/B4: saves the trimmed name for the signed-in user only", async () => {
    const res = await send({ name: "  Jane  ", id: "someone-else" });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { name: "Jane" } });
  });

  it("B2: refuses an empty or too-long name with a plain message, saving nothing", async () => {
    for (const name of ["", "   ", "x".repeat(61)]) {
      const res = await send({ name });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/^Please /);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("B4: answers 401 without a session, saving nothing", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await send({ name: "Jane" });
    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
