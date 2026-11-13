import { describe, it, expect, vi, beforeEach } from "vitest";

const mockConstructEvent = vi.fn();
const switches = { droneEnabled: false, rooferEnabled: false };

vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/journeys", () => ({ journeys: switches }));

const { POST } = await import("./route");

function req() {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=abc" },
    body: "{}",
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  switches.droneEnabled = false;
  switches.rooferEnabled = false;
  mockConstructEvent.mockReset().mockImplementation(() => {
    throw new Error("bad signature");
  });
});

describe("POST /api/stripe/webhook with both journeys off", () => {
  it("answers 404 and handles no event", async () => {
    const res = await POST(req());
    expect(res.status).toBe(404);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/webhook with a journey on", () => {
  it.each(["droneEnabled", "rooferEnabled"] as const)("checks the event as before when %s", async (key) => {
    switches[key] = true;
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(mockConstructEvent).toHaveBeenCalledTimes(1);
  });
});
