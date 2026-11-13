import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { ReportDocument } from "./pdf";
import { REPORT_DISCLAIMER, TERMS_REFERENCE } from "@/content/legal/disclaimer";
import type { ReportAnalysis } from "./claude";

const ANALYSIS = {
  condition_score: 7,
  confidence: "medium",
  estimated_remaining_life_years: 10,
  urgent_action_required: false,
  defects: [],
  recommendations: ["Clear the gutters."],
  surveyor_notes: "Tiles in fair condition.",
} as unknown as ReportAnalysis;

/** Every piece of text in the document's element tree, joined. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (typeof node === "object" && "props" in node) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return "";
}

describe("the report PDF's disclaimer (BL-057 / SPEC-024 C1)", () => {
  const doc = ReportDocument({
    analysis: ANALYSIS,
    address: "12 High Street",
    postcode: "TQ9 5QH",
    generatedAt: "13 November 2026",
    imageBase64s: ["aGVsbG8="],
  });
  const text = textOf(doc);

  it("carries the report disclaimer and names the Terms, on the report page and the photo page", () => {
    expect(text.split(REPORT_DISCLAIMER).length - 1).toBe(2);
    expect(text).toContain(TERMS_REFERENCE);
  });

  it("no longer carries the old one-line disclaimer", () => {
    expect(text).not.toContain("should be verified by a qualified roofer");
  });
});
