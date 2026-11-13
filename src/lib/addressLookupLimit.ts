// Limits how many paid address lookups one user can make in a rolling window
// (BL-074 / SPEC-022 A5). Counted from AddressLookup rows, because a serverless
// function keeps no memory between requests. Only lookups that returned
// addresses are recorded, since only those cost anything.
import { prisma } from "@/lib/prisma";

export const ADDRESS_LOOKUP_LIMIT = 20;
export const ADDRESS_LOOKUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function addressLookupLimitReached(userId: string, now: Date = new Date()): Promise<boolean> {
  const made = await prisma.addressLookup.count({
    where: { userId, createdAt: { gte: new Date(now.getTime() - ADDRESS_LOOKUP_WINDOW_MS) } },
  });
  return made >= ADDRESS_LOOKUP_LIMIT;
}

export async function recordAddressLookup(userId: string): Promise<void> {
  await prisma.addressLookup.create({ data: { userId } });
}
