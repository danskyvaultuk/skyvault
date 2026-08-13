"use client";

import { useState } from "react";

export interface RoofContext {
  ageBand?: "0-5" | "5-15" | "15+" | "not_sure";
  ageNote?: string;
  material?: "slate" | "tile" | "felt" | "shingle" | "not_sure";
  shape?: "flat" | "pitched";
  slopeCount?: number;
  problemAreas?: string;
}

const AGE_OPTIONS: { value: NonNullable<RoofContext["ageBand"]>; label: string }[] = [
  { value: "0-5", label: "0–5 years" },
  { value: "5-15", label: "5–15 years" },
  { value: "15+", label: "15+ years" },
  { value: "not_sure", label: "Not sure" },
];

const MATERIAL_OPTIONS: { value: NonNullable<RoofContext["material"]>; label: string }[] = [
  { value: "slate", label: "Slate" },
  { value: "tile", label: "Tile" },
  { value: "felt", label: "Felt" },
  { value: "shingle", label: "Shingle" },
  { value: "not_sure", label: "Not sure" },
];

interface Props {
  surveyId: string;
  postcode: string;
  initial?: RoofContext | null;
  onSaved?: (context: RoofContext) => void;
  /** Shown as a numbered badge next to the heading when this card is one step
   * in a guided upload → tag → details flow. Omit to render without a number. */
  stepNumber?: number;
}

export function RoofContextCard({ surveyId, postcode, initial, onSaved, stepNumber }: Props) {
  // Once the customer has answered anything (or explicitly skipped), the card starts
  // collapsed — "asked once per survey" means once ever, not once per page load.
  const [expanded, setExpanded] = useState(!initial);
  const [dismissed, setDismissed] = useState(!!initial);
  const [context, setContext] = useState<RoofContext>(initial ?? {});
  const [saving, setSaving] = useState(false);

  async function save(next: RoofContext) {
    setContext(next);
    setSaving(true);
    await fetch(`/api/surveys/${surveyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roofContext: next }),
    });
    setSaving(false);
    onSaved?.(next);
  }

  function update<K extends keyof RoofContext>(key: K, value: RoofContext[K]) {
    save({ ...context, [key]: value });
  }

  function handleSkip() {
    save({});
    setDismissed(true);
    setExpanded(false);
  }

  const hasAnswers = Object.values(context).some((v) => v !== undefined && v !== "");

  if (!expanded) {
    return (
      <div className="bg-gray-50 border rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {hasAnswers ? "Roof details added" : "Roof details skipped"}
        </p>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-blue-600 hover:underline font-medium"
        >
          {hasAnswers ? "Edit" : "Add details"}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl p-6 mb-6">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          {stepNumber !== undefined && (
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
              {stepNumber}
            </span>
          )}
          <h2 className="text-base font-semibold text-gray-900">Tell us about the roof</h2>
        </div>
        {!dismissed && (
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Skip this step
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Optional — a few quick details help the AI interpret what it sees. Skip anything
        you&apos;re not sure about.
      </p>

      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Location</p>
          <p className="text-sm text-gray-500">{postcode} <span className="text-gray-400">(from your property)</span></p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Roof age</p>
          <div className="grid grid-cols-4 gap-2">
            {AGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("ageBand", context.ageBand === opt.value ? undefined : opt.value)}
                className={`py-2 rounded-lg text-xs font-medium border transition ${
                  context.ageBand === opt.value
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={context.ageNote ?? ""}
            onChange={(e) => setContext((c) => ({ ...c, ageNote: e.target.value }))}
            onBlur={() => save(context)}
            maxLength={300}
            placeholder="Any known repair or replacement work? (optional)"
            className="mt-2 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Material</p>
          <div className="grid grid-cols-5 gap-2">
            {MATERIAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("material", context.material === opt.value ? undefined : opt.value)}
                className={`py-2 rounded-lg text-xs font-medium border transition ${
                  context.material === opt.value
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Shape</p>
          <div className="flex gap-3 items-center">
            <div className="grid grid-cols-2 gap-2 flex-1">
              {(["pitched", "flat"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update("shape", context.shape === s ? undefined : s)}
                  className={`py-2 rounded-lg text-xs font-medium border transition capitalize ${
                    context.shape === s
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={0}
              max={20}
              value={context.slopeCount ?? ""}
              onChange={(e) =>
                setContext((c) => ({
                  ...c,
                  slopeCount: e.target.value === "" ? undefined : Number(e.target.value),
                }))
              }
              onBlur={() => save(context)}
              placeholder="Slopes (optional)"
              className="w-32 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Known problem areas <span className="text-gray-400 font-normal">(optional)</span>
          </p>
          <textarea
            value={context.problemAreas ?? ""}
            onChange={(e) => setContext((c) => ({ ...c, problemAreas: e.target.value }))}
            onBlur={() => save(context)}
            rows={2}
            maxLength={500}
            placeholder="e.g. leak near chimney, gutter overflow after rain…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-5">
        <p className="text-xs text-gray-400">{saving ? "Saving…" : "Saved automatically"}</p>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-blue-600 hover:underline font-medium"
        >
          Done
        </button>
      </div>
    </div>
  );
}
