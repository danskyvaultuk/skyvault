import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageUploader, UPLOAD_PROMPT } from "./image-uploader";

describe("ImageUploader (BL-078 / SPEC-027 A1, B2)", () => {
  const html = renderToStaticMarkup(<ImageUploader surveyId="s1" />);

  it("B2: says 'Take or choose photos', never drop or click", () => {
    expect(UPLOAD_PROMPT).toBe("Take or choose photos");
    expect(html).toContain("Take or choose photos");
    expect(html).not.toMatch(/drop/i);
    expect(html).not.toMatch(/click/i);
  });

  it("A1: has no separate upload button; choosing photos adds them to the upload queue", () => {
    expect(html).not.toMatch(/Upload \d+ image/);
    const source = readFileSync("src/components/surveys/image-uploader.tsx", "utf8");
    expect(source).toContain("if (e.target.files) addFiles(Array.from(e.target.files));");
    expect(source).not.toContain("uploadAll");
  });
});
