import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Stands in for the uploader so the test can read which roof parts each
// checklist row hands it; the real uploader saves its photos with those parts.
vi.mock("@/components/surveys/image-uploader", () => ({
  ImageUploader: ({ roofParts }: { roofParts?: readonly string[] }) => (
    <div data-testid="uploader" data-roof-parts={(roofParts ?? []).join(",")} />
  ),
}));

const { PhotoChecklist } = await import("./photo-checklist");
const { checklistStatus } = await import("@/lib/photoChecklist");

function render(notApplicable: Parameters<typeof checklistStatus>[1] = []) {
  return renderToStaticMarkup(
    <PhotoChecklist surveyId="survey-1" status={checklistStatus([], notApplicable)} onToggleNotApplicable={() => {}} onUploadComplete={() => {}} />
  );
}

describe("PhotoChecklist — side slopes and other roof parts (BL-076 / SPEC-023)", () => {
  it("A2/B2: uploads under Side slopes are labelled side, and under the other-parts item secondary_roof", () => {
    const html = render();
    expect(html).toContain("Side slopes");
    expect(html).toContain('data-roof-parts="side"');
    expect(html).toContain("Flat roofs, dormers, bays and porches");
    expect(html).toContain('data-roof-parts="secondary_roof"');
  });

  it("A2: both new items show as needed, with a not-applicable button", () => {
    const html = render();
    const row = (label: string) => html.slice(html.indexOf(label), html.indexOf(label) + 2000);
    for (const label of ["Side slopes", "Flat roofs, dormers, bays and porches"]) {
      expect(row(label)).toContain("Needed");
      expect(row(label)).toContain("Not applicable to my roof");
    }
  });

  it("A2: marked not applicable, a new item shows so and offers no upload", () => {
    const html = render(["side_slopes"]);
    expect(html).not.toContain('data-roof-parts="side"');
    expect(html).toContain("Actually, I can add this");
  });
});
