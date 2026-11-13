import { describe, expect, it } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { ReportDocument } from "./pdf";
import { PDF_FOOTER_LINE, REPORT_DISCLAIMER, TERMS_REFERENCE } from "@/content/legal/disclaimer";
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

type Props = { children?: ReactNode; style?: Record<string, number | string>; fixed?: boolean };
type Element = ReactElement<Props>;

const isElement = (node: ReactNode): node is Element =>
  typeof node === "object" && node !== null && !Array.isArray(node) && "props" in node;

function childrenOf(node: ReactNode): ReactNode[] {
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  return isElement(node) ? [node.props.children].flat() : [];
}

/** Every piece of text under a node, joined. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return isElement(node) ? textOf(node.props.children) : "";
}

/** Every element in the tree that matches. */
function findAll(node: ReactNode, match: (e: Element) => boolean): Element[] {
  if (Array.isArray(node)) return node.flatMap((n) => findAll(n, match));
  if (!isElement(node)) return [];
  return [...(match(node) ? [node] : []), ...findAll(node.props.children, match)];
}

const doc = ReportDocument({
  analysis: ANALYSIS,
  address: "12 High Street",
  postcode: "TQ9 5QH",
  generatedAt: "13 November 2026",
  imageBase64s: ["aGVsbG8="],
});
const footers = findAll(doc, (e) => e.props.fixed === true);
const pages = findAll(doc, (e) => typeof e.props.style?.paddingBottom === "number" && footers.length > 0 && findAll(e.props.children, (c) => c.props.fixed === true).length > 0);

describe("the report PDF's disclaimer (BL-057 / SPEC-025 Part A)", () => {
  it("A1: ends the report page with an Important section holding the full disclaimer and the Terms reference in body text", () => {
    const sections = findAll(doc, (e) => !e.props.fixed && childrenOf(e).some((c) => isElement(c) && textOf(c) === "Important"));
    expect(sections).toHaveLength(1);
    const text = textOf(sections[0]);
    expect(text).toContain(REPORT_DISCLAIMER);
    expect(text).toContain(TERMS_REFERENCE);
    const body = findAll(sections[0], (e) => textOf(e).includes(REPORT_DISCLAIMER) && typeof e.props.style?.fontSize === "number");
    expect(Math.min(...body.map((e) => Number(e.props.style?.fontSize)))).toBeGreaterThanOrEqual(10);
  });

  it("A2: carries the full disclaimer exactly once, and in no footer", () => {
    expect(textOf(doc).split(REPORT_DISCLAIMER).length - 1).toBe(1);
    for (const footer of footers) expect(textOf(footer)).not.toContain(REPORT_DISCLAIMER);
  });
});

describe("the report PDF's footer (BL-057 / SPEC-025 Part B)", () => {
  it("B1: every page's footer is one short line naming SkyVault, the AI-assisted assessment and the disclaimer", () => {
    expect(footers.length).toBe(2); // the report page and the photo page
    for (const footer of footers) expect(textOf(footer)).toBe(PDF_FOOTER_LINE);
    expect(PDF_FOOTER_LINE.length).toBeLessThanOrEqual(90);
    expect(PDF_FOOTER_LINE).toContain("SkyVault");
    expect(PDF_FOOTER_LINE).toContain("AI-assisted assessment, not a professional survey");
    expect(PDF_FOOTER_LINE).toContain("disclaimer");
  });

  it("B1: the footer is a single line, not a row of columns", () => {
    for (const footer of footers) {
      expect(footer.props.style?.flexDirection).not.toBe("row");
      expect(findAll(footer.props.children, () => true)).toHaveLength(1);
    }
  });

  it("B2: each page's bottom padding leaves room for the footer, so content stops above it", () => {
    expect(pages.length).toBe(2);
    for (const page of pages) {
      const [footer] = findAll(page.props.children, (e) => e.props.fixed === true);
      const [line] = findAll(footer.props.children, () => true);
      const footerTop = Number(footer.props.style?.bottom) + Number(footer.props.style?.paddingTop ?? 0) + Number(line.props.style?.fontSize) * 1.5;
      expect(Number(page.props.style?.paddingBottom)).toBeGreaterThan(footerTop);
    }
  });
});
