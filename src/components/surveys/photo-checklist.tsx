"use client";

import { ImageUploader } from "@/components/surveys/image-uploader";
import { cn } from "@/lib/utils";
import { checklistSummary, type ChecklistId, type ChecklistItemStatus } from "@/lib/photoChecklist";

interface Props {
  surveyId: string;
  status: ChecklistItemStatus[];
  onToggleNotApplicable: (id: ChecklistId) => void;
  onUploadComplete: () => void;
}

const STATE_BADGE = {
  done: { text: "Done", colour: "bg-green-100 text-green-700" },
  "not-applicable": { text: "Not applicable", colour: "bg-gray-100 text-gray-600" },
  missing: { text: "Needed", colour: "bg-amber-100 text-amber-700" },
} as const;

function ChecklistRow({
  entry, surveyId, onToggleNotApplicable, onUploadComplete,
}: { entry: ChecklistItemStatus } & Omit<Props, "status">) {
  const { item, state } = entry;
  const badge = STATE_BADGE[state];
  return (
    <div className="bg-white border rounded-xl px-4 py-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-medium text-gray-900">{item.label}</p>
          <p className="text-sm text-gray-500">{item.hint}</p>
        </div>
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full shrink-0", badge.colour)}>{badge.text}</span>
      </div>
      {state !== "not-applicable" && (
        <ImageUploader surveyId={surveyId} roofParts={item.roofParts} compact onUploadComplete={onUploadComplete} />
      )}
      {state !== "done" && (
        <button
          type="button"
          onClick={() => onToggleNotApplicable(item.id)}
          className="mt-2 text-xs text-gray-500 hover:text-gray-700 hover:underline"
        >
          {state === "not-applicable" ? "Actually, I can add this" : "Not applicable to my roof"}
        </button>
      )}
    </div>
  );
}

// The guided self-upload checklist (BL-021): one labelled upload area per shot
// the analysis needs, then anything else. Missing shots warn; they never block.
export function PhotoChecklist(props: Props) {
  const { status, surveyId, onUploadComplete } = props;
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">{checklistSummary(status)}</p>
      {status.map((entry) => (
        <ChecklistRow key={entry.item.id} entry={entry} {...props} />
      ))}
      <div className="bg-white border rounded-xl px-4 py-4">
        <p className="font-medium text-gray-900">Anything else</p>
        <p className="text-sm text-gray-500 mb-3">Close-ups of any damage or areas you&apos;re worried about.</p>
        <ImageUploader surveyId={surveyId} compact onUploadComplete={onUploadComplete} />
      </div>
    </div>
  );
}
