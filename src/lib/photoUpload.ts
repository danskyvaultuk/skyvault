// Uploads one photo (BL-078 / SPEC-027): asks SkyVault for an upload address,
// sends the photo straight to storage with progress, then registers it so the
// server can check it. The answer says whether a retry could help: "failed"
// (signal, storage or a server error) can be retried; "refused" is the
// server's photo advice (BL-018), which a retry would only repeat.
import type { RoofPart } from "@/lib/photoTag";

export type UploadOutcome =
  | { kind: "done"; s3Key: string }
  | { kind: "refused"; message: string }
  | { kind: "failed"; message: string };

/** Sends the file to the upload address, reporting progress (0–100); resolves with the HTTP status. */
export type PutFile = (url: string, file: File, onProgress: (percent: number) => void) => Promise<number>;

type Deps = { fetch: typeof fetch; put: PutFile };

type Request = { surveyId: string; file: File; roofParts?: readonly RoofPart[]; onProgress: (percent: number) => void };

const NO_SIGNAL = "The upload didn't finish. Check your signal and tap Retry.";

/** The browser's way of sending a file with progress. */
export const xhrPut: PutFile = (url, file, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });

async function register(req: Request, s3Key: string, deps: Deps): Promise<UploadOutcome> {
  const res = await deps.fetch(`/api/surveys/${req.surveyId}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      s3Key,
      originalFilename: req.file.name,
      mimeType: req.file.type,
      sizeBytes: req.file.size,
      // Labelled with its checklist item, when uploaded under one (BL-021).
      ...(req.roofParts?.length ? { roofParts: req.roofParts } : {}),
    }),
  });
  if (res.ok) return { kind: "done", s3Key };
  if (res.status >= 500) return { kind: "failed", message: "Something went wrong saving this photo. Tap Retry." };
  const body = (await res.json().catch(() => ({}))) as { guidance?: string; error?: string };
  return { kind: "refused", message: body.guidance ?? body.error ?? "This photo couldn't be added." };
}

export async function uploadPhoto(req: Request, deps: Deps = { fetch, put: xhrPut }): Promise<UploadOutcome> {
  try {
    const presign = await deps.fetch(`/api/surveys/${req.surveyId}/images/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: req.file.name, contentType: req.file.type, sizeBytes: req.file.size }),
    });
    if (!presign.ok) {
      if (presign.status >= 500) return { kind: "failed", message: NO_SIGNAL };
      const body = (await presign.json().catch(() => ({}))) as { error?: string };
      return { kind: "refused", message: body.error ?? "This photo couldn't be added." };
    }
    const { s3Key, uploadUrl } = (await presign.json()) as { s3Key: string; uploadUrl: string };
    const status = await deps.put(uploadUrl, req.file, req.onProgress);
    if (status < 200 || status >= 300) return { kind: "failed", message: NO_SIGNAL };
    return await register(req, s3Key, deps);
  } catch {
    return { kind: "failed", message: NO_SIGNAL };
  }
}
