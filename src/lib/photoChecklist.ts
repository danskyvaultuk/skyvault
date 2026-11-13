// The guided self-upload checklist (BL-021): the shots the analysis needs.
// An item is covered by any photo carrying one of its roof parts, whether the
// photo was uploaded under the item or labelled by hand later. Missing items
// warn the customer but never block analysis.
import type { RoofPart } from "@/lib/photoTag";

export type ChecklistItem = {
  id: "ridge" | "front_slope" | "rear_slope" | "gutters" | "chimney_flashings" | "side_slopes" | "secondary_roofs";
  label: string;
  hint: string;
  roofParts: readonly RoofPart[];
};

export const CHECKLIST: readonly ChecklistItem[] = [
  { id: "ridge", label: "Ridge", hint: "The top line of the roof, where the slopes meet.", roofParts: ["ridge"] },
  { id: "front_slope", label: "Front slope", hint: "Stand back so the whole front of the roof is in shot.", roofParts: ["front"] },
  { id: "rear_slope", label: "Rear slope", hint: "The whole back of the roof, from the garden if you can.", roofParts: ["back"] },
  { id: "gutters", label: "Gutters", hint: "Along the bottom edge of the roof, including any downpipes.", roofParts: ["gutter"] },
  {
    id: "chimney_flashings",
    label: "Chimney and flashings",
    hint: "The chimney and the metal strips where the roof meets walls or the chimney.",
    roofParts: ["chimney", "flashing"],
  },
  // BL-076: the checklist was written for a gable roof. A hipped roof also
  // slopes at the sides, and many houses have smaller roofs besides the main one.
  {
    id: "side_slopes",
    label: "Side slopes",
    hint: "If your roof also slopes down at the sides (a hipped roof), photograph each side. If the sides are flat brick walls, or you're mid-terrace, mark this as not applicable.",
    roofParts: ["side"],
  },
  {
    id: "secondary_roofs",
    label: "Flat roofs, dormers, bays and porches",
    hint: "Any flat roof (such as on an extension or garage), dormer window, bay window roof or porch roof. If you have none of these, mark this as not applicable.",
    roofParts: ["secondary_roof"],
  },
];

export type ChecklistId = ChecklistItem["id"];
export type ChecklistState = "done" | "not-applicable" | "missing";
export type ChecklistItemStatus = { item: ChecklistItem; state: ChecklistState };

type LabelledPhoto = { roofParts: readonly string[] };

export function checklistStatus(
  photos: readonly LabelledPhoto[],
  notApplicable: readonly ChecklistId[]
): ChecklistItemStatus[] {
  const covered = new Set(photos.flatMap((p) => p.roofParts));
  return CHECKLIST.map((item) => {
    if (item.roofParts.some((part) => covered.has(part))) return { item, state: "done" };
    return { item, state: notApplicable.includes(item.id) ? "not-applicable" : "missing" };
  });
}

export function missingLabels(status: readonly ChecklistItemStatus[]): string[] {
  return status.filter((s) => s.state === "missing").map((s) => s.item.label);
}

export function checklistSummary(status: readonly ChecklistItemStatus[]): string {
  const missing = missingLabels(status);
  const settled = status.length - missing.length;
  const tail = missing.length === 0 ? "every shot covered" : `missing: ${missing.map((m) => m.toLowerCase()).join(", ")}`;
  return `${settled} of ${status.length} done — ${tail}`;
}
