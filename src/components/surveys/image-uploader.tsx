"use client";

import { useRef, useCallback } from "react";
import { useUpload } from "@/hooks/use-upload";
import { cn } from "@/lib/utils";

interface Props {
  surveyId: string;
  onUploadComplete?: (count: number) => void;
}

export function ImageUploader({ surveyId, onUploadComplete }: Props) {
  const { files, addFiles, uploadAll, removeFile, uploading, doneCount } = useUpload(surveyId);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const incoming = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      addFiles(incoming);
    },
    [addFiles]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    const uploaded = await uploadAll();
    onUploadComplete?.(uploaded);
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-gray-600 font-medium">Drop roof images here, or click to browse</p>
        <p className="text-sm text-gray-400 mt-1">JPEG, PNG, WebP — max 20MB each — up to 10 images</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white border rounded-lg px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file.name}</p>
                {f.status === "uploading" && (
                  <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
                {f.status === "error" && (
                  <p className="text-xs text-red-500 mt-0.5">{f.error}</p>
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  f.status === "done" && "bg-green-100 text-green-700",
                  f.status === "uploading" && "bg-blue-100 text-blue-700",
                  f.status === "pending" && "bg-gray-100 text-gray-600",
                  f.status === "error" && "bg-red-100 text-red-700"
                )}
              >
                {f.status === "uploading" ? `${f.progress}%` : f.status}
              </span>
              {f.status !== "uploading" && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingCount > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
        >
          {uploading ? `Uploading…` : `Upload ${pendingCount} image${pendingCount !== 1 ? "s" : ""}`}
        </button>
      )}

      {doneCount >= 1 && (
        <p className="text-sm text-green-600 font-medium text-center">
          {doneCount} image{doneCount !== 1 ? "s" : ""} uploaded — ready to analyse
        </p>
      )}
    </div>
  );
}
