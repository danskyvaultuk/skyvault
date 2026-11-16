// Storage keys for survey photos (BL-064 / SPEC-028 Part A). The server signs
// and stores a photo's key, so it accepts only a key of the exact form it
// issues for that survey; otherwise a signed-in customer could register
// another object's key and get a signed link to it.
import { randomUUID } from "node:crypto";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const EXTENSION = /^[a-z0-9]{1,5}$/;

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
  return EXTENSION.test(ext) ? ext : "jpg";
}

function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** A new key for a photo of this survey: surveys/<survey>/images/<uuid>.<ext>. */
export function issuePhotoKey(surveyId: string, filename: string): string {
  return `surveys/${surveyId}/images/${randomUUID()}.${extensionOf(filename)}`;
}

/** Whether the key has exactly the form issuePhotoKey gives for this survey. */
export function isIssuedPhotoKey(surveyId: string, key: string): boolean {
  return new RegExp(`^surveys/${escapeForPattern(surveyId)}/images/${UUID}\\.[a-z0-9]{1,5}$`).test(key);
}
