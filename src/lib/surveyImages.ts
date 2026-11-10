import { getPresignedReadUrl } from "@/lib/r2";
import sharp from "sharp";

export type SurveyPhoto = { s3Key: string; originalFilename: string | null };
export type PreparedPhoto = { base64: string; mimeType: string };

// Claude Vision limit is 5MB per image.
// We resize to max 1568px and convert to JPEG so every image comfortably fits.
// The original full-res file stays untouched in S3.
async function resizeForClaude(buffer: ArrayBuffer): Promise<{ data: Buffer; mimeType: string }> {
  const resized = await sharp(Buffer.from(buffer))
    .resize(1568, 1568, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  return { data: resized, mimeType: "image/jpeg" };
}

/**
 * Fetches a survey's photos from storage and resizes them for the AI and the
 * PDF. Used by the analysis pipeline and when an admin correction re-makes
 * the PDF (BL-061).
 */
export async function fetchSurveyPhotos(photos: SurveyPhoto[]): Promise<PreparedPhoto[]> {
  return Promise.all(
    photos.map(async (img) => {
      const readUrl = await getPresignedReadUrl(img.s3Key);
      const response = await fetch(readUrl);
      if (!response.ok) throw new Error(`Failed to fetch image: ${img.s3Key}`);
      const rawBuffer = await response.arrayBuffer();

      const { data, mimeType } = await resizeForClaude(rawBuffer);
      const sizeKB = Math.round(data.length / 1024);
      console.log(`[photos] Resized ${img.originalFilename ?? img.s3Key} → ${sizeKB}KB`);

      return { base64: data.toString("base64"), mimeType };
    })
  );
}
