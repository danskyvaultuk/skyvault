import { describe, expect, it, vi } from "vitest";
import { findAddresses } from "./idealPostcodes";

function reply(status: number, body: unknown) {
  return vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status }));
}

describe("findAddresses (BL-074)", () => {
  it("asks the provider for the postcode with the key", async () => {
    const fetchImpl = reply(200, { code: 2000, result: [] });
    await findAddresses("TQ9 5QH", "ak_test", fetchImpl);
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://api.ideal-postcodes.co.uk/v1/postcodes/TQ9%205QH");
    expect(url.searchParams.get("api_key")).toBe("ak_test");
  });

  it("maps each result to a street address, town and postcode", async () => {
    const fetchImpl = reply(200, {
      code: 2000,
      result: [
        { line_1: "Flat 2", line_2: "10 High Street", line_3: "", post_town: "TOTNES", postcode: "TQ9 5QH" },
        { line_1: "12 High Street", line_2: "", line_3: "", post_town: "TOTNES", postcode: "TQ9 5QH" },
      ],
    });
    expect(await findAddresses("TQ9 5QH", "ak_test", fetchImpl)).toEqual({
      kind: "found",
      addresses: [
        { address: "Flat 2, 10 High Street", town: "TOTNES", postcode: "TQ9 5QH" },
        { address: "12 High Street", town: "TOTNES", postcode: "TQ9 5QH" },
      ],
    });
  });

  it("treats the provider's 404 as not found", async () => {
    const fetchImpl = reply(404, { code: 4040, message: "Postcode not found" });
    expect(await findAddresses("ZZ9 9ZZ", "ak_test", fetchImpl)).toEqual({ kind: "not-found" });
  });

  it("treats an empty result as not found", async () => {
    const fetchImpl = reply(200, { code: 2000, result: [] });
    expect(await findAddresses("ZZ9 9ZZ", "ak_test", fetchImpl)).toEqual({ kind: "not-found" });
  });

  it("reports any other answer as failed, with the status", async () => {
    const fetchImpl = reply(402, { code: 4020, message: "Token balance depleted" });
    expect(await findAddresses("TQ9 5QH", "ak_test", fetchImpl)).toEqual({ kind: "failed", reason: "status 402" });
  });

  it("reports an unreadable body as failed", async () => {
    const fetchImpl = reply(200, { code: 2000, result: [{ nope: true }] });
    const outcome = await findAddresses("TQ9 5QH", "ak_test", fetchImpl);
    expect(outcome.kind).toBe("failed");
  });
});
