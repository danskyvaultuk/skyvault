// Checks a just-uploaded photo before it joins a survey (BL-018). Reads the
// file back from storage and assesses it; a rejection is logged with its
// measurements so the limits can be tuned. A storage hiccup never blocks the
// customer: the photo is then saved unchecked (`pending`).
import type { ImageValidationStatus } from "@prisma/client";
import { getPresignedReadUrl } from "@/lib/r2";
import { assessPhotoQuality, photoQualityLimits, PHOTO_GUIDANCE, type RejectionReason } from "@/lib/photoQuality";

export type UploadCheck =
  | { kind: "rejected"; reason: RejectionReason; guidance: string }
  | { kind: "saved"; validation: { validationStatus: ImageValidationStatus; validationNotes: string | null } };

async function readStoredFile(s3Key: string): Promise<Buffer | null> {
  try {
    const response = await fetch(await getPresignedReadUrl(s3Key));
    if (!response.ok) throw new Error(`storage answered ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.error(`[photo-quality] could not read ${s3Key} to check it; saving unchecked:`, err);
    return null;
  }
}

export async function checkUploadedPhoto(surveyId: string, s3Key: string): Promise<UploadCheck> {
  const bytes = await readStoredFile(s3Key);
  if (!bytes) return { kind: "saved", validation: { validationStatus: "pending", validationNotes: null } };

  const limits = photoQualityLimits({
    SKYVAULT_PHOTO_MIN_SIDE: process.env.SKYVAULT_PHOTO_MIN_SIDE,
    SKYVAULT_PHOTO_MIN_SHARPNESS: process.env.SKYVAULT_PHOTO_MIN_SHARPNESS,
  });
  const result = await assessPhotoQuality(bytes, limits);

  if (result.outcome === "rejected") {
    console.warn("[photo-quality] rejected", JSON.stringify({ surveyId, s3Key, ...result, limits }));
    return { kind: "rejected", reason: result.reason, guidance: PHOTO_GUIDANCE[result.reason] };
  }
  const notes = `checked: ${result.width}x${result.height}, sharpness ${result.sharpness}`;
  return { kind: "saved", validation: { validationStatus: "valid", validationNotes: notes } };
}
