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
  selected: T | null;
  onSelect: (value: T) => void;
  onClear?: () => void;
}

export function TapChipSelector<T extends string>({ options, selected, onSelect, onClear }: Props<T>) {
  return (
    <div className="bg-white rounded-lg shadow-lg border p-2 flex flex-wrap gap-1.5 max-w-[220px]">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition ${
            selected === opt.value
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-gray-200 hover:border-gray-300 text-gray-600"
          }`}
        >
          {opt.label}
        </button>
      ))}
      {selected && onClear && (
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
