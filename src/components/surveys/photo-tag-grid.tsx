"use client";

import { useEffect, useState } from "react";
import { TapChipSelector } from "@/components/ui/tap-chip-selector";
import {
  ROOF_PARTS, ROOF_PART_LABELS, ASPECTS, ASPECT_LABELS,
  type RoofPart, type Aspect,
} from "@/lib/photoTag";

export interface TaggablePhoto {
  id: string;
  url: string;
  roofParts: RoofPart[];
  aspect: Aspect | null;
}

interface TagState {
  roofParts: RoofPart[];
  aspect: Aspect | null;
  saving: boolean;
  error: boolean;
}

const PART_OPTIONS = ROOF_PARTS.map((value) => ({ value, label: ROOF_PART_LABELS[value] }));
const ASPECT_OPTIONS = ASPECTS.map((value) => ({ value, label: ASPECT_LABELS[value] }));

// Short badge text for a compass direction, shown as its own corner badge
// separate from the roof-part badge — the two are independent dimensions.
const ASPECT_ABBR: Record<Aspect, string> = { north: "N", south: "S", east: "E", west: "W" };

interface Props {
  photos: TaggablePhoto[];
}

export function PhotoTagGrid({ photos }: Props) {
  const [tags, setTags] = useState<Record<string, TagState>>(() =>
    Object.fromEntries(
      photos.map((p) => [p.id, { roofParts: p.roofParts, aspect: p.aspect, saving: false, error: false }])
    )
  );
  const [openId, setOpenId] = useState<string | null>(null);

  // New photos can arrive after upload completes — seed state for any photo
  // id we haven't seen yet without clobbering in-flight/local edits.
  useEffect(() => {
    setTags((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of photos) {
        if (!(p.id in next)) {
          next[p.id] = { roofParts: p.roofParts, aspect: p.aspect, saving: false, error: false };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [photos]);

  async function saveTag(photoId: string, next: { roofParts: RoofPart[]; aspect: Aspect | null }) {
    const previous = tags[photoId] ?? { roofParts: [], aspect: null };
    setTags((prev) => ({ ...prev, [photoId]: { ...next, saving: true, error: false } }));

    try {
      const res = await fetch(`/api/photos/${photoId}/tag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Failed to save tag");
      setTags((prev) => ({ ...prev, [photoId]: { ...next, saving: false, error: false } }));
    } catch {
      // Revert the optimistic update and surface an inline retry — never a blocking error.
      setTags((prev) => ({
        ...prev,
        [photoId]: { roofParts: previous.roofParts, aspect: previous.aspect, saving: false, error: true },
      }));
    }
  }

  function setParts(photoId: string, roofParts: RoofPart[]) {
    const aspect = tags[photoId]?.aspect ?? null;
    saveTag(photoId, { roofParts, aspect });
  }

  function setAspect(photoId: string, aspect: Aspect[]) {
    const roofParts = tags[photoId]?.roofParts ?? [];
    saveTag(photoId, { roofParts, aspect: aspect[0] ?? null });
  }

  function clearAll(photoId: string) {
    saveTag(photoId, { roofParts: [], aspect: null });
    setOpenId(null);
  }

  if (photos.length === 0) return null;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">
        Optional — tap a photo to label what it shows and which way it faces.
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {photos.map((photo) => {
          const tag = tags[photo.id] ?? { roofParts: photo.roofParts, aspect: photo.aspect, saving: false, error: false };
          const isOpen = openId === photo.id;
          const hasTag = tag.roofParts.length > 0 || !!tag.aspect;
          const partLabel = tag.roofParts.length > 0
            ? tag.roofParts.map((p) => ROOF_PART_LABELS[p]).join(", ")
            : null;

          return (
            <div key={photo.id} className="relative">
              <div
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border cursor-pointer"
                onClick={() => setOpenId(isOpen ? null : photo.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="w-full h-full object-cover" />

                {tag.saving && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {partLabel && !tag.saving && (
                  <span className="absolute bottom-1 left-1 right-1 text-[10px] font-medium bg-black/70 text-white px-1.5 py-0.5 rounded truncate">
                    {partLabel}
                  </span>
                )}

                {tag.aspect && !tag.saving && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {ASPECT_ABBR[tag.aspect]}
                  </span>
                )}

                {!hasTag && !tag.saving && (
                  <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">
                    +
                  </span>
                )}
              </div>

              {tag.error && (
                <button
                  type="button"
                  onClick={() => saveTag(photo.id, { roofParts: tag.roofParts, aspect: tag.aspect })}
                  className="mt-1 text-[11px] text-red-500 hover:underline"
                >
                  Couldn&apos;t save — Retry
                </button>
              )}

              {isOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenId(null)} />
                  <div className="absolute top-full left-0 mt-1 z-20 space-y-2">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 px-1">
                        What&apos;s shown
                      </p>
                      <TapChipSelector
                        options={PART_OPTIONS}
                        selected={tag.roofParts}
                        onChange={(next) => setParts(photo.id, next)}
                        multiple
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 px-1">
                        Direction (optional)
                      </p>
                      <TapChipSelector
                        options={ASPECT_OPTIONS}
                        selected={tag.aspect ? [tag.aspect] : []}
                        onChange={(next) => setAspect(photo.id, next)}
                        multiple={false}
                      />
                    </div>
                    {hasTag && (
                      <button
                        type="button"
                        onClick={() => clearAll(photo.id)}
                        className="w-full text-center text-xs text-gray-400 hover:text-red-500 bg-white rounded-lg border shadow-lg py-1.5"
                      >
                        Clear all tags
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
