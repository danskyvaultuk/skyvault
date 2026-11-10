import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const switches = { droneEnabled: false, rooferEnabled: false };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));
vi.mock("@/lib/journeys", () => ({ journeys: switches }));

const { POST } = await import("./route");

function req(role: string) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "jane@example.com", name: "Jane", role }),
  });
}

beforeEach(() => {
  switches.droneEnabled = false;
  switches.rooferEnabled = false;
  mockFindUnique.mockReset().mockResolvedValue(null);
  mockCreate.mockReset().mockResolvedValue({ id: "user-1" });
});

describe("POST /api/auth/register with the drone and roofer journeys off", () => {
  it.each(["roofer", "drone"])("refuses the %s role and creates no user", async (role) => {
    const res = await POST(req(role));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("accepts the customer role", async () => {
    const res = await POST(req("customer"));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { email: "jane@example.com", name: "Jane", role: "customer" },
    });
  });
});

describe("POST /api/auth/register with a journey on", () => {
  it("accepts the roofer role while the roofer journey is on", async () => {
    switches.rooferEnabled = true;
    const res = await POST(req("roofer"));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("accepts the drone role while the drone journey is on", async () => {
    switches.droneEnabled = true;
    const res = await POST(req("drone"));
    expect(res.status).toBe(200);
  });
});
