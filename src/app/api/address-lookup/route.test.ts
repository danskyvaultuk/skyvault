import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAuth = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockCaptureException = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    addressLookup: {
      count: (...args: unknown[]) => mockCount(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));
// The real reportError runs, so these tests show the failure reaching Sentry
// itself (SPEC-022 A4) and what is sent with it.
vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => mockCaptureException(...args) }));
vi.spyOn(console, "error").mockImplementation(() => {});

const { GET } = await import("./route");

const KEY = "ak_secret_key_value";
const FOUND = {
  code: 2000,
  result: [{ line_1: "12 High Street", line_2: "", line_3: "", post_town: "TOTNES", postcode: "TQ9 5QH" }],
};

function lookup(postcode: string) {
  return GET(new Request(`http://localhost/api/address-lookup?postcode=${encodeURIComponent(postcode)}`));
}

/** What one Sentry report carried: the error's message and its tags and extras. */
function sentToSentry(call: number) {
  const [error, hint] = mockCaptureException.mock.calls[call];
  return JSON.stringify({ message: (error as Error).message, hint });
}

function providerReplies(status: number, body: unknown) {
  mockFetch.mockImplementation(async () => new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubEnv("IDEAL_POSTCODES_API_KEY", KEY);
  mockAuth.mockReset().mockResolvedValue({ user: { id: "user-1", role: "customer" } });
  mockCount.mockReset().mockResolvedValue(0);
  mockCreate.mockReset().mockResolvedValue({});
  mockCaptureException.mockReset();
  mockFetch.mockReset();
  providerReplies(200, FOUND);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/address-lookup (BL-074 / SPEC-022 Part A)", () => {
  it("A1: refuses a request with no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await lookup("TQ9 5QH");
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("A1: returns the addresses at a postcode, in the shape the property form saves", async () => {
    const res = await lookup("tq95qh");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      addresses: [{ address: "12 High Street", town: "TOTNES", postcode: "TQ9 5QH" }],
    });
    expect(String(mockFetch.mock.calls[0][0])).toContain("/v1/postcodes/TQ9%205QH");
  });

  it("A1/A5: counts a lookup that returned addresses", async () => {
    await lookup("TQ9 5QH");
    expect(mockCreate).toHaveBeenCalledWith({ data: { userId: "user-1" } });
  });

  it("A2: refuses an invalid postcode without calling the provider", async () => {
    const res = await lookup("not a postcode");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("A3: answers an unknown postcode with an empty list and a message, and does not count it", async () => {
    providerReplies(404, { code: 4040, message: "Postcode not found" });
    const res = await lookup("ZZ9 9ZZ");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.addresses).toEqual([]);
    expect(body.message).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("A4: never puts the key in the response", async () => {
    const text = await (await lookup("TQ9 5QH")).text();
    expect(text).not.toContain(KEY);
  });

  it("A4: answers 503 when the key is missing, without calling the provider, and reports it to Sentry", async () => {
    vi.stubEnv("IDEAL_POSTCODES_API_KEY", "");
    const res = await lookup("TQ9 5QH");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it("A4: answers 503 when the provider fails, reports it to Sentry without the postcode or key, and counts nothing", async () => {
    providerReplies(500, { code: 5000 });
    const res = await lookup("TQ9 5QH");
    expect(res.status).toBe(503);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(sentToSentry(0)).not.toMatch(/TQ9/i);
    expect(sentToSentry(0)).not.toContain(KEY);
  });

  it("A4: answers 503 when the provider cannot be reached, and reports it to Sentry without the postcode", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    const res = await lookup("TQ9 5QH");
    expect(res.status).toBe(503);
    expect(sentToSentry(0)).not.toMatch(/TQ9/i);
  });

  it("A5: accepts the 20th lookup", async () => {
    mockCount.mockResolvedValue(19);
    const res = await lookup("TQ9 5QH");
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("A5: refuses the 21st lookup with 429 and a plain message, without calling the provider", async () => {
    mockCount.mockResolvedValue(20);
    const res = await lookup("TQ9 5QH");
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/try again/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("A5: counts the signed-in user's own lookups", async () => {
    await lookup("TQ9 5QH");
    expect(mockCount.mock.calls[0][0].where.userId).toBe("user-1");
  });
});
