import { prisma } from "@/lib/prisma";
import { notifyRooferNewLead } from "@/lib/resend";

/**
 * Extract the outward code from a UK postcode.
 * "SW1A 1AA" → "SW1A"
 * "M1 1AE"   → "M1"
 * Falls back to the full string if there's no space.
 */
function outwardCode(postcode: string): string {
  return postcode.trim().toUpperCase().split(" ")[0];
}

/**
 * Called after a survey report is published.
 * Creates a Lead record and emails any eligible subscribed roofers
 * whose postcode prefix matches the property's outward code.
 *
 * Returns the created Lead.
 */
export async function distributeLeads(
  surveyId: string,
  reportId: string,
  propertyPostcode: string
) {
  // Create the lead (idempotent — skip if one already exists for this survey)
  const existing = await prisma.lead.findUnique({ where: { surveyId } });
  if (existing) return existing;

  const lead = await prisma.lead.create({
    data: {
      surveyId,
      reportId,
      postcode: outwardCode(propertyPostcode),
      status: "open",
      maxRoofers: 3,
    },
  });

  // Find all roofers with an active subscription — no postcode filter for now
  const eligibleRoofers = await prisma.user.findMany({
    where: {
      role: "roofer",
      subscription: { status: "active" },
    },
    include: { subscription: true },
  });

  console.log(
    `[leads] Lead ${lead.id} created for ${propertyPostcode}. ` +
    `${eligibleRoofers.length} eligible roofer(s) found.`
  );

  // Email each eligible roofer
  await Promise.allSettled(
    eligibleRoofers.map((roofer) =>
      notifyRooferNewLead({
        rooferEmail: roofer.email,
        rooferName: roofer.name ?? "there",
        leadId: lead.id,
        postcode: propertyPostcode,
      })
    )
  );

  return lead;
}
