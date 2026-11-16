// Records each photo the photo check refuses (BL-080 / SPEC-029 C1, C2), so the
// admin dashboard can show how often customers struggle with photos. Saving the
// record must never change the customer's answer, so a failure is only reported.
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/monitoring";

export async function recordPhotoRefusal(surveyId: string, reason: string): Promise<void> {
  try {
    await prisma.photoRefusal.create({ data: { surveyId, reason } });
  } catch (error) {
    reportError(error, { what: "photo-refusal-record", surveyId, reason });
  }
}
