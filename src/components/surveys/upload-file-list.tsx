// The photos chosen in one upload area (BL-078 / SPEC-027 B1, E1, E2): a
// thumbnail of each with its state. A failed upload offers Retry; a photo the
// server refused shows its advice. Controls are at least 44px tall for thumbs.
import { cn } from "@/lib/utils";
import type { UploadEntry } from "@/lib/uploadSession";

type Props = {
  files: readonly UploadEntry[];
  onRetry: (id: number) => void;
  onRemove: (id: number) => void;
};

const STATE_LABEL: Record<UploadEntry["status"], { text: string; colour: string }> = {
  pending: { text: "Waiting", colour: "bg-gray-100 text-gray-600" },
  uploading: { text: "Uploading", colour: "bg-blue-100 text-blue-700" },
  done: { text: "Uploaded", colour: "bg-green-100 text-green-700" },
  failed: { text: "Not uploaded", colour: "bg-red-100 text-red-700" },
  refused: { text: "Not accepted", colour: "bg-amber-100 text-amber-800" },
};

const CONTROL = "min-h-[44px] px-3 rounded-lg text-sm font-medium";

function UploadRow({ entry, onRetry, onRemove }: { entry: UploadEntry } & Omit<Props, "files">) {
  const state = STATE_LABEL[entry.status];
  return (
    <li className="flex items-center gap-3 bg-white border rounded-lg p-2">
      {/* A thumbnail of the photo itself, so the customer can check the shot. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not an optimisable asset */}
      <img src={entry.previewUrl} alt="Your photo" className="w-16 h-16 rounded-md object-cover shrink-0 bg-gray-100" />
      <div className="flex-1 min-w-0">
        <span className={cn("inline-block text-xs font-medium px-2 py-0.5 rounded-full", state.colour)}>
          {entry.status === "uploading" ? `${state.text} ${entry.progress}%` : state.text}
        </span>
        {entry.status === "uploading" && (
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={entry.progress}>
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${entry.progress}%` }} />
          </div>
        )}
        {entry.message && <p className="text-xs text-gray-700 mt-1">{entry.message}</p>}
      </div>
      {entry.status === "failed" && (
        <button type="button" onClick={() => onRetry(entry.id)} className={cn(CONTROL, "bg-blue-700 text-white")}>
          Retry
        </button>
      )}
      {entry.status !== "uploading" && entry.status !== "pending" && entry.status !== "done" && (
        <button
          type="button"
          aria-label="Remove photo"
          onClick={() => onRemove(entry.id)}
          className={cn(CONTROL, "min-w-[44px] text-gray-500 hover:text-red-600 text-xl leading-none")}
        >
          ×
        </button>
      )}
    </li>
  );
}

export function UploadFileList({ files, onRetry, onRemove }: Props) {
  if (files.length === 0) return null;
  return (
    <ul className="space-y-2">
      {files.map((entry) => (
        <UploadRow key={entry.id} entry={entry} onRetry={onRetry} onRemove={onRemove} />
      ))}
    </ul>
  );
}
