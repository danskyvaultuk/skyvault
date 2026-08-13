"use client";

import { useEffect, useRef, useState } from "react";
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

const EMPTY_TAG: TagState = { roofParts: [], aspect: null, saving: false, error: false };

export function PhotoTagGrid({ photos }: Props) {
  const initial = Object.fromEntries(
    photos.map((p) => [p.id, { roofParts: p.roofParts, aspect: p.aspect, saving: false, error: false }])
  );
  const [tags, setTags] = useState<Record<string, TagState>>(initial);
  const [openId, setOpenId] = useState<string | null>(null);

  // Mirrors `tags` but updated synchronously (plain assignment, not through
  // React's batched setState) so that two taps fired in quick succession —
  // exactly what multi-select encourages — each read the true latest value
  // instead of a stale one from a closure that hasn't re-rendered yet.
  const tagsRef = useRef(initial);
  function getTag(photoId: string): TagState {
    return tagsRef.current[photoId] ?? EMPTY_TAG;
  }
  function writeTag(photoId: string, next: TagState) {
    tagsRef.current = { ...tagsRef.current, [photoId]: next };
    setTags(tagsRef.current);
  }

  // New photos can arrive after upload completes — seed state for any photo
  // id we haven't seen yet without clobbering in-flight/local edits.
  useEffect(() => {
    let changed = false;
    const next = { ...tagsRef.current };
    for (const p of photos) {
      if (!(p.id in next)) {
        next[p.id] = { roofParts: p.roofParts, aspect: p.aspect, saving: false, error: false };
        changed = true;
      }
    }
    if (changed) {
      tagsRef.current = next;
      setTags(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  async function saveTag(photoId: string, next: { roofParts: RoofPart[]; aspect: Aspect | null }) {
    const previous = getTag(photoId);
    writeTag(photoId, { ...next, saving: true, error: false });

    try {
      const res = await fetch(`/api/photos/${photoId}/tag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Failed to save tag");
      writeTag(photoId, { ...next, saving: false, error: false });
    } catch {
      // Revert the optimistic update and surface an inline retry — never a blocking error.
      writeTag(photoId, { roofParts: previous.roofParts, aspect: previous.aspect, saving: false, error: true });
    }
  }

  function setParts(photoId: string, roofParts: RoofPart[]) {
    saveTag(photoId, { roofParts, aspect: getTag(photoId).aspect });
  }

  function setAspect(photoId: string, aspect: Aspect[]) {
    saveTag(photoId, { roofParts: getTag(photoId).roofParts, aspect: aspect[0] ?? null });
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

              {/* Bottom-sheet on all sizes rather than an inline popover anchored to the
                  thumbnail — an anchored popover doesn't reserve layout space, so once it
                  grew to two chip groups it visually overlapped whatever was below it on
                  the page. A fixed sheet with its own backdrop avoids that regardless of
                  where the thumbnail sits in the grid or how long the chip lists get. */}
              {isOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpenId(null)} />
                  <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl p-5 max-h-[85vh] overflow-y-auto sm:max-w-sm sm:mx-auto sm:inset-x-0 sm:bottom-8 sm:rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="w-12 h-12 rounded-lg object-cover border flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Tag this photo</p>
                        <p className="text-xs text-gray-400">Optional — tap to select, tap again to remove</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenId(null)}
                        className="ml-auto text-gray-400 hover:text-gray-600 text-2xl leading-none px-1 flex-shrink-0"
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>

                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      What&apos;s shown
                    </p>
                    <TapChipSelector
                      options={PART_OPTIONS}
                      selected={tag.roofParts}
                      onChange={(next) => setParts(photo.id, next)}
                      multiple
                      bare
                    />

                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-1">
                      Which way does this roof slope face?
                    </p>
                    <p className="text-[11px] text-gray-400 mb-2">
                      Optional — e.g. a south-facing slope gets more sun and weathers differently
                      to a shaded, north-facing one.
                    </p>
                    <TapChipSelector
                      options={ASPECT_OPTIONS}
                      selected={tag.aspect ? [tag.aspect] : []}
                      onChange={(next) => setAspect(photo.id, next)}
                      multiple={false}
                      bare
                    />

                    <div className="flex items-center gap-3 mt-5">
                      {hasTag && (
                        <button
                          type="button"
                          onClick={() => clearAll(photo.id)}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          Clear all tags
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenId(null)}
                        className="ml-auto bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-800"
                      >
                        Done
                      </button>
                    </div>
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
