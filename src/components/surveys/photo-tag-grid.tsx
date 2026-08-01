"use client";

import { useEffect, useState } from "react";
import { TapChipSelector } from "@/components/ui/tap-chip-selector";
import { ROOF_PARTS, ROOF_PART_LABELS, type RoofPart } from "@/lib/photoTag";

export interface TaggablePhoto {
  id: string;
  url: string;
  roofPart: RoofPart | null;
  captureMethod: string | null;
}

interface TagState {
  roofPart: RoofPart | null;
  saving: boolean;
  error: boolean;
}

const CHIP_OPTIONS = ROOF_PARTS.map((value) => ({ value, label: ROOF_PART_LABELS[value] }));

interface Props {
  photos: TaggablePhoto[];
}

export function PhotoTagGrid({ photos }: Props) {
  const [tags, setTags] = useState<Record<string, TagState>>(() =>
    Object.fromEntries(
      photos.map((p) => [p.id, { roofPart: p.roofPart, saving: false, error: false }])
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
          next[p.id] = { roofPart: p.roofPart, saving: false, error: false };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [photos]);

  async function setTag(photoId: string, roofPart: RoofPart | null) {
    const previous = tags[photoId]?.roofPart ?? null;
    setTags((prev) => ({ ...prev, [photoId]: { roofPart, saving: true, error: false } }));
    setOpenId(null);

    try {
      const res = await fetch(`/api/photos/${photoId}/tag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roofPart }),
      });
      if (!res.ok) throw new Error("Failed to save tag");
      setTags((prev) => ({ ...prev, [photoId]: { roofPart, saving: false, error: false } }));
    } catch {
      // Revert the optimistic update and surface an inline retry — never a blocking error.
      setTags((prev) => ({ ...prev, [photoId]: { roofPart: previous, saving: false, error: true } }));
    }
  }

  if (photos.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Tag your photos</h3>
        <span className="text-xs text-gray-400">Optional — tap a photo to label it</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {photos.map((photo) => {
          const tag = tags[photo.id] ?? { roofPart: photo.roofPart, saving: false, error: false };
          const isOpen = openId === photo.id;

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

                {tag.roofPart && !tag.saving && (
                  <span className="absolute bottom-1 left-1 text-[10px] font-medium bg-black/70 text-white px-1.5 py-0.5 rounded">
                    {ROOF_PART_LABELS[tag.roofPart]}
                  </span>
                )}

                {!tag.roofPart && !tag.saving && (
                  <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">
                    +
                  </span>
                )}
              </div>

              {tag.error && (
                <button
                  type="button"
                  onClick={() => setTag(photo.id, tag.roofPart)}
                  className="mt-1 text-[11px] text-red-500 hover:underline"
                >
                  Couldn&apos;t save — Retry
                </button>
              )}

              {isOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenId(null)} />
                  <div className="absolute top-full left-0 mt-1 z-20">
                    <TapChipSelector
                      options={CHIP_OPTIONS}
                      selected={tag.roofPart}
                      onSelect={(value) => setTag(photo.id, value)}
                      onClear={tag.roofPart ? () => setTag(photo.id, null) : undefined}
                    />
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
