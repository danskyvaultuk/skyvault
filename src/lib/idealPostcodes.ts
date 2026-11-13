// Ideal Postcodes address lookup (BL-074 / SPEC-022 A1, A3, A4). Runs on the
// server only: the key never reaches the browser. A found postcode costs one
// lookup; an unknown one (HTTP 404, code 4040) costs nothing.
import { z } from "zod";

export type FoundAddress = { address: string; town: string; postcode: string };

export type LookupOutcome =
  | { kind: "found"; addresses: FoundAddress[] }
  | { kind: "not-found" }
  | { kind: "failed"; reason: string };

type FetchLike = (input: string) => Promise<Response>;

const ProviderAddress = z.object({
  line_1: z.string(),
  line_2: z.string().optional().default(""),
  line_3: z.string().optional().default(""),
  post_town: z.string(),
  postcode: z.string(),
});
const ProviderReply = z.object({ result: z.array(ProviderAddress) });

const PROVIDER = "https://api.ideal-postcodes.co.uk/v1/postcodes/";

export async function findAddresses(postcode: string, apiKey: string, fetchImpl: FetchLike): Promise<LookupOutcome> {
  const url = `${PROVIDER}${encodeURIComponent(postcode)}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url);
  if (res.status === 404) return { kind: "not-found" };
  if (!res.ok) return { kind: "failed", reason: `status ${res.status}` };

  const parsed = ProviderReply.safeParse(await res.json());
  if (!parsed.success) return { kind: "failed", reason: "unreadable reply" };
  if (parsed.data.result.length === 0) return { kind: "not-found" };
  return {
    kind: "found",
    addresses: parsed.data.result.map((a) => ({
      address: [a.line_1, a.line_2, a.line_3].filter((line) => line.trim() !== "").join(", "),
      town: a.post_town,
      postcode: a.postcode,
    })),
  };
}
