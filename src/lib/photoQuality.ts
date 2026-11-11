// Photo quality check at upload (BL-018). A photo too small or too blurry to
// analyse is rejected before it joins a survey, with guidance on retaking it.
// The limits are settings so they can be tuned from real rejections.
import sharp from "sharp";

export type PhotoQualityLimits = { minSide: number; minSharpness: number };
export type RejectionReason = "too-small" | "too-blurry" | "unreadable";

type Measured = { width: number; height: number; sharpness: number };

export type PhotoAssessment =
  | ({ outcome: "accepted" } & Measured)
  | ({ outcome: "rejected"; reason: "too-small" | "too-blurry" } & Measured)
  | { outcome: "rejected"; reason: "unreadable" };

export const PHOTO_GUIDANCE: Record<RejectionReason, string> = {
  "too-small":
    "This photo is too small to check your roof properly. Please use your phone's normal camera, not a screenshot or a photo sent through a messaging app.",
  "too-blurry":
    "This photo looks blurry. Hold the phone steady, tap the screen to focus on the roof, and take it again in good light.",
  unreadable: "We couldn't open this file as a photo. Please upload a JPEG, PNG or WebP photo.",
};

const DEFAULTS: PhotoQualityLimits = { minSide: 720, minSharpness: 8 };

// The photo is reduced to fit this box before sharpness is measured, so the
// score does not depend on the camera's resolution.
const WORKING_SIZE = 1024;
const LAPLACIAN = [0, 1, 0, 1, -4, 1, 0, 1, 0];

function positiveNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? n : fallback;
}

export function photoQualityLimits(env: {
  SKYVAULT_PHOTO_MIN_SIDE?: string;
  SKYVAULT_PHOTO_MIN_SHARPNESS?: string;
}): PhotoQualityLimits {
  return {
    minSide: positiveNumber(env.SKYVAULT_PHOTO_MIN_SIDE, DEFAULTS.minSide),
    minSharpness: positiveNumber(env.SKYVAULT_PHOTO_MIN_SHARPNESS, DEFAULTS.minSharpness),
  };
}

function variance(values: Uint8Array): number {
  let sum = 0;
  let sumSquares = 0;
  for (const v of values) {
    sum += v;
    sumSquares += v * v;
  }
  const mean = sum / values.length;
  return sumSquares / values.length - mean * mean;
}

/** Variance of a Laplacian filter over a greyscale working copy: low means few sharp edges. */
async function sharpnessOf(bytes: Buffer): Promise<number> {
  const grey = await sharp(bytes)
    .rotate()
    .greyscale()
    .resize({ width: WORKING_SIZE, height: WORKING_SIZE, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const edges = await sharp(grey.data, { raw: { width: grey.info.width, height: grey.info.height, channels: 1 } })
    .convolve({ width: 3, height: 3, kernel: LAPLACIAN, offset: 128 })
    .raw()
    .toBuffer();
  return variance(edges);
}

async function measure(bytes: Buffer): Promise<Measured | null> {
  try {
    const { width, height } = await sharp(bytes).metadata();
    if (!width || !height) return null;
    return { width, height, sharpness: Math.round((await sharpnessOf(bytes)) * 10) / 10 };
  } catch {
    return null;
  }
}

export async function assessPhotoQuality(bytes: Buffer, limits: PhotoQualityLimits): Promise<PhotoAssessment> {
  const measured = await measure(bytes);
  if (!measured) return { outcome: "rejected", reason: "unreadable" };
  if (Math.min(measured.width, measured.height) < limits.minSide) {
    return { outcome: "rejected", reason: "too-small", ...measured };
  }
  if (measured.sharpness < limits.minSharpness) return { outcome: "rejected", reason: "too-blurry", ...measured };
  return { outcome: "accepted", ...measured };
}
