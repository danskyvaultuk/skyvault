import { describe, it, expect, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));

const { POST } = await import("./route");

describe("POST /api/admin/sentry-test (SPEC-020 C1)", () => {
  it("throws an identifiable Sentry test error for an admin, through the real request path", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    await expect(POST()).rejects.toThrow(/^Sentry test error \d{4}-\d{2}-\d{2}T/);
  });

  it("refuses a customer without throwing the test error", async () => {
    mockAuth.mockResolvedValue({ user: { id: "cust-1", role: "customer" } });
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("refuses a visitor who is not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });
});
