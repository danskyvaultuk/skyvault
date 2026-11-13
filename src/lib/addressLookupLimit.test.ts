import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCount = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    addressLookup: {
      count: (...args: unknown[]) => mockCount(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

const { ADDRESS_LOOKUP_LIMIT, ADDRESS_LOOKUP_WINDOW_MS, addressLookupLimitReached, recordAddressLookup } =
  await import("./addressLookupLimit");

const NOW = new Date("2026-11-13T12:00:00.000Z");

beforeEach(() => {
  mockCount.mockReset();
  mockCreate.mockReset().mockResolvedValue({});
});

describe("address lookup limit (BL-074)", () => {
  it("is 20 lookups per 24 hours", () => {
    expect(ADDRESS_LOOKUP_LIMIT).toBe(20);
    expect(ADDRESS_LOOKUP_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("is reached at 20 and not at 19", async () => {
    mockCount.mockResolvedValue(20);
    expect(await addressLookupLimitReached("user-1", NOW)).toBe(true);
    mockCount.mockResolvedValue(19);
    expect(await addressLookupLimitReached("user-1", NOW)).toBe(false);
  });

  it("counts the user's lookups in the last 24 hours", async () => {
    mockCount.mockResolvedValue(0);
    await addressLookupLimitReached("user-1", NOW);
    expect(mockCount.mock.calls[0][0].where).toEqual({
      userId: "user-1",
      createdAt: { gte: new Date(NOW.getTime() - ADDRESS_LOOKUP_WINDOW_MS) },
    });
  });

  it("records a lookup for the user", async () => {
    await recordAddressLookup("user-1");
    expect(mockCreate).toHaveBeenCalledWith({ data: { userId: "user-1" } });
  });
});
