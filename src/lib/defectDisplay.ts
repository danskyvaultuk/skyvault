// What the customer sees of each defect (BL-009), shared by the report page and
// the PDF. Priority is the label; severity stays behind the scenes. Location is
// phrased from the photo, crediting the customer's own label, and never as a
// measured slope (ADR-008). Defects from before BL-009 still display.
// Defects in a peripheral zone (BL-004) are listed in their own section.
import type { StoredDefect } from "@/lib/claude";
import { CHECKLIST } from "@/lib/photoChecklist";
import { ROOF_PART_LABELS, type RoofPart } from "@/lib/photoTag";
import { ZONE_LABELS } from "@/lib/peripheralZones";

export type CustomerDefect = {
  key: "urgent" | "high" | "medium" | "low" | "critical";
  label: string;
  typeText: string;
  description: string;
  categoryText: string | null;
  locationText: string;
  /** The peripheral zone's name, or null when the defect is in none. */
  zoneText: string | null;
};

const ORDER: Record<CustomerDefect["key"], number> = { urgent: 0, critical: 0, high: 1, medium: 2, low: 3 };

const CATEGORY_TEXT = {
  functional: "Functional — affects how the roof works",
  cosmetic: "Cosmetic — appearance only",
} as const;

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The customer's own name for a photo: its checklist shot, else its first label. */
function photoLabel(roofParts: readonly string[] | undefined): string | null {
  if (!roofParts || roofParts.length === 0) return null;
  const shot = CHECKLIST.find((item) => item.roofParts.some((p) => roofParts.includes(p)));
  if (shot) return shot.label.toLowerCase();
  const first = roofParts[0] as RoofPart;
  return (ROOF_PART_LABELS[first] ?? first).toLowerCase();
}

function locationText(defect: StoredDefect, photoRoofParts: readonly (readonly string[])[]): string {
  const label = photoLabel(photoRoofParts[defect.image_index]);
  const photo = `Seen in photo ${defect.image_index + 1}${label ? ` (your ${label} photo)` : ""}`;
  return defect.location ? `${photo}: ${defect.location}` : photo;
}

export function customerDefects(
  defects: readonly StoredDefect[],
  photoRoofParts: readonly (readonly string[])[]
): CustomerDefect[] {
  return defects
    .map((d): CustomerDefect => {
      const key = d.priority ?? d.severity;
      return {
        key,
        label: capitalise(key),
        typeText: capitalise(d.type.replace(/_/g, " ")),
        description: d.description,
        categoryText: d.category ? CATEGORY_TEXT[d.category] : null,
        locationText: locationText(d, photoRoofParts),
        zoneText: d.zone && d.zone !== "none" ? ZONE_LABELS[d.zone] : null,
      };
    })
    .sort((a, b) => ORDER[a.key] - ORDER[b.key]);
}

export type CustomerDefectSections = { peripheral: CustomerDefect[]; other: CustomerDefect[] };

/** The defects split into "Peripheral concerns" and the main list, each most urgent first. */
export function customerDefectSections(
  defects: readonly StoredDefect[],
  photoRoofParts: readonly (readonly string[])[]
): CustomerDefectSections {
  const all = customerDefects(defects, photoRoofParts);
  return { peripheral: all.filter((d) => d.zoneText !== null), other: all.filter((d) => d.zoneText === null) };
}
