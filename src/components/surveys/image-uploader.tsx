"use client";

// One upload area (BL-078 / SPEC-027). Choosing photos starts their upload at
// once, a few at a time; there is no separate upload button.
import { useRef, useCallback } from "react";
import { useUpload } from "@/hooks/use-upload";
import { cn } from "@/lib/utils";
import type { RoofPart } from "@/lib/photoTag";
import { UploadFileList } from "@/components/surveys/upload-file-list";

interface Props {
  surveyId: string;
  onUploadComplete?: (count: number) => void;
  /** Labels every photo uploaded here, e.g. a checklist item's roof parts (BL-021). */
  roofParts?: readonly RoofPart[];
  /** A smaller area, for use inside a checklist item. */
  compact?: boolean;
}

export const UPLOAD_PROMPT = "Take or choose photos";

export function ImageUploader({ surveyId, onUploadComplete, roofParts, compact = false }: Props) {
  const { files, addFiles, retry, removeFile, doneCount } = useUpload(surveyId, roofParts, onUploadComplete);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")));
    },
    [addFiles]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    // Let the same photo be chosen again after it is removed.
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "w-full min-h-[44px] border-2 border-dashed border-gray-300 rounded-xl text-center hover:border-blue-400 hover:bg-blue-50 transition",
          compact ? "p-4" : "p-8"
        )}
      >
        <span className="block text-gray-700 font-medium">📷 {UPLOAD_PROMPT}</span>
        {!compact && <span className="block text-sm text-gray-500 mt-1">JPEG, PNG or WebP · up to 20 MB each · up to 10 photos</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <UploadFileList files={files} onRetry={retry} onRemove={removeFile} />

      {doneCount >= 1 && (
        <p className="text-sm text-green-600 font-medium text-center">
          {doneCount} photo{doneCount !== 1 ? "s" : ""} uploaded
        </p>
      )}
    </div>
  );
}
