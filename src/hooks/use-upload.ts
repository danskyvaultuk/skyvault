"use client";

import { useState, useCallback } from "react";

export interface UploadFile {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  s3Key?: string;
  error?: string;
}

export function useUpload(surveyId: string) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const updateFile = (index: number, patch: Partial<UploadFile>) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const addFiles = useCallback((incoming: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...incoming.map((file) => ({ file, status: "pending" as const, progress: 0 })),
    ]);
  }, []);

  const uploadAll = useCallback(async (): Promise<number> => {
    setUploading(true);
    const pendingIndices = files
      .map((f, i) => (f.status === "pending" ? i : -1))
      .filter((i) => i >= 0);

    const results = await Promise.all(
      pendingIndices.map(async (index) => {
        const { file } = files[index];
        updateFile(index, { status: "uploading", progress: 0 });

        try {
          const presignRes = await fetch(`/api/surveys/${surveyId}/images/presign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
              sizeBytes: file.size,
            }),
          });

          if (!presignRes.ok) throw new Error("Failed to get upload URL");
          const { s3Key, uploadUrl } = await presignRes.json();

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                updateFile(index, { progress: Math.round((e.loaded / e.total) * 100) });
              }
            };
            xhr.onload = async () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                await fetch(`/api/surveys/${surveyId}/images`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    s3Key,
                    originalFilename: file.name,
                    mimeType: file.type,
                    sizeBytes: file.size,
                  }),
                });
                updateFile(index, { status: "done", progress: 100, s3Key });
                resolve();
              } else {
                reject(new Error(`Upload failed: ${xhr.status}`));
              }
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.open("PUT", uploadUrl);
            xhr.setRequestHeader("Content-Type", file.type);
            xhr.send(file);
          });

          return 1 as number; // successfully uploaded
        } catch (err) {
          updateFile(index, { status: "error", error: (err as Error).message });
          return 0 as number;
        }
      })
    );

    setUploading(false);
    return results.reduce((sum: number, n: number) => sum + n, 0);
  }, [files, surveyId]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const doneCount = files.filter((f) => f.status === "done").length;

  return { files, addFiles, uploadAll, removeFile, uploading, doneCount };
}
