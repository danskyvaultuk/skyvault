"use client";

// Minimal local tap-target chip selector, built for SV-046 because SV-047's
// shared chip component (progress dots, skip button, shared styling) hadn't
// landed yet. Intentionally small and self-contained — swap call sites over
// to the SV-047 component once it exists rather than extending this one.

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: ChipOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  /** true (default): tapping a chip toggles it in/out — several can be active.
   *  false: tapping a chip replaces the whole selection with just that value
   *  (tapping the already-selected chip again clears it). */
  multiple?: boolean;
  onClear?: () => void;
  /** Render just the chips with no card chrome (bg/border/shadow/max-width) —
   * for embedding inside a parent that already provides the card, e.g. a
   * bottom-sheet modal with multiple chip groups. */
  bare?: boolean;
}

export function TapChipSelector<T extends string>({
  options,
  selected,
  onChange,
  multiple = true,
  onClear,
  bare = false,
}: Props<T>) {
  function handleTap(value: T) {
    if (multiple) {
      onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
    } else {
      onChange(selected.includes(value) ? [] : [value]);
    }
  }

  return (
    <div className={bare ? "flex flex-wrap gap-1.5" : "bg-white rounded-lg shadow-lg border p-2 flex flex-wrap gap-1.5 max-w-[240px]"}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => handleTap(opt.value)}
          className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition ${
            selected.includes(opt.value)
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-gray-200 hover:border-gray-300 text-gray-600"
          }`}
        >
          {opt.label}
        </button>
      ))}
      {selected.length > 0 && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="px-2.5 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-red-500"
        >
          Clear
        </button>
      )}
    </div>
  );
}
