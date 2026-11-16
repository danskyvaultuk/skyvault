import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { NameStep } = await import("./name-step");

describe("NameStep (BL-081 / SPEC-030 B1, B2)", () => {
  it("B1: asks What should we call you?, with one name field and Continue", () => {
    const html = renderToStaticMarkup(<NameStep />).replace(/&#x27;/g, "'");
    expect(html).toContain("What should we call you?");
    expect(html.match(/<input/g)).toHaveLength(1);
    expect(html).toMatch(/<input[^>]*id="display-name"[^>]*maxLength="60"/);
    expect(html).toMatch(/<button type="submit"[^>]*>Continue<\/button>/);
    expect(html).not.toMatch(/skip/i);
  });

  it("B2: saves to the name route, then refreshes the page the customer asked for", () => {
    const source = readFileSync("src/components/name-step.tsx", "utf8");
    expect(source).toContain('fetch("/api/account/name"');
    expect(source).toContain('method: "PATCH"');
    expect(source).toContain("router.refresh()");
  });
});
