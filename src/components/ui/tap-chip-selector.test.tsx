import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TapChipSelector } from "./tap-chip-selector";

describe("TapChipSelector tap targets (BL-078 / SPEC-027 E1)", () => {
  it("every chip, and the clear control, is at least 44px tall", () => {
    const html = renderToStaticMarkup(
      <TapChipSelector
        options={[{ value: "front", label: "Front" }, { value: "back", label: "Back" }]}
        selected={["front"]}
        onChange={() => {}}
        onClear={() => {}}
      />
    );
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const button of buttons) expect(button).toContain("min-h-[44px]");
  });
});
