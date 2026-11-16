import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Text with no colour of its own must stay readable on the light backgrounds.
describe("home page text contrast", () => {
  it("the site has no dark-mode text colour, which turned uncoloured text near-white on white", () => {
    expect(readFileSync("src/app/globals.css", "utf8")).not.toContain("prefers-color-scheme: dark");
  });

  it("the headings on light backgrounds carry their own colour", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(page).toContain('text-blue-700 mb-12">Three steps to a roof report</h2>');
    expect(page).toContain('text-blue-700 mb-4">Simple pricing for homeowners</h2>');
    expect(page).toContain('<h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>');
    expect(page).toContain('card: "bg-white rounded-xl border p-8 text-gray-900"');
  });
});
