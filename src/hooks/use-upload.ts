"use client";

// One upload area's photos (BL-078 / SPEC-027): a thin React wrapper around
// UploadSession, which holds the queue rules.
import { useRef, useSyncExternalStore } from "react";
import type { RoofPart } from "@/lib/photoTag";
import { uploadPhoto } from "@/lib/photoUpload";
import { UploadSession } from "@/lib/uploadSession";

export type { UploadEntry } from "@/lib/uploadSession";

export function useUpload(surveyId: string, roofParts?: readonly RoofPart[], onUploadComplete?: (count: number) => void) {
  const onDrained = useRef(onUploadComplete);
  onDrained.current = onUploadComplete;

  const session = useRef<UploadSession | null>(null);
  session.current ??= new UploadSession({
    upload: (file, onProgress) => uploadPhoto({ surveyId, file, roofParts, onProgress }),
    preview: (file) => URL.createObjectURL(file),
    onDrained: (uploaded) => onDrained.current?.(uploaded),
  });
  const current = session.current;

  const files = useSyncExternalStore(current.subscribe, current.getSnapshot, current.getSnapshot);

  return {
    files,
    addFiles: (incoming: File[]) => current.add(incoming),
    retry: (id: number) => current.retry(id),
    removeFile: (id: number) => current.remove(id),
    uploading: files.some((f) => f.status === "pending" || f.status === "uploading"),
    doneCount: files.filter((f) => f.status === "done").length,
  };
}
