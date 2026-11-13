// Finds the addresses at a UK postcode for Add property (BL-074 / SPEC-022 Part A).
// The paid provider is called from here, so its key stays on the server and the
// browser only ever talks to SkyVault.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { formatUkPostcode } from "@/lib/ukPostcode";
import { findAddresses, type LookupOutcome } from "@/lib/idealPostcodes";
import { addressLookupLimitReached, recordAddressLookup } from "@/lib/addressLookupLimit";
import { reportError } from "@/lib/monitoring";

const UNAVAILABLE = "Address search isn't working right now. Please enter your address by hand.";

function unavailable(error: unknown) {
  // No postcode or other personal data goes to Sentry (SPEC-022 A4).
  reportError(error, { what: "address-lookup" });
  return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
}

async function askProvider(postcode: string, apiKey: string): Promise<LookupOutcome> {
  try {
    return await findAddresses(postcode, apiKey, (url) => fetch(url));
  } catch {
    return { kind: "failed", reason: "provider unreachable" };
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const postcode = formatUkPostcode(new URL(req.url).searchParams.get("postcode") ?? "");
  if (!postcode) {
    return NextResponse.json({ error: "Please enter a full UK postcode, like TQ9 5QH." }, { status: 400 });
  }

  if (await addressLookupLimitReached(session.user.id)) {
    return NextResponse.json(
      { error: "You've searched for addresses the most times allowed in one day. Please try again tomorrow, or enter your address by hand." },
      { status: 429 }
    );
  }

  const apiKey = process.env.IDEAL_POSTCODES_API_KEY?.trim();
  if (!apiKey) return unavailable(new Error("IDEAL_POSTCODES_API_KEY is not set"));

  const outcome = await askProvider(postcode, apiKey);
  if (outcome.kind === "failed") return unavailable(new Error(`Address provider failed: ${outcome.reason}`));
  if (outcome.kind === "not-found") {
    return NextResponse.json({ addresses: [], message: "We couldn't find any addresses for that postcode. Please check it, or enter your address by hand." });
  }

  await recordAddressLookup(session.user.id);
  return NextResponse.json({ addresses: outcome.addresses });
}
