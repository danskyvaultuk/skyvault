import { describe, expect, it } from "vitest";
import { isIssuedPhotoKey, issuePhotoKey } from "./photoKeys";

const SURVEY = "ckq1z2x3y0000a1b2c3d4e5f6";
const OTHER = "ckq1z2x3y0000zzzzzzzzzzzz";
const UUID = "3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b23";

describe("issuePhotoKey (BL-064 / SPEC-028 A3)", () => {
  it("issues surveys/<survey>/images/<uuid>.<ext>, which the check accepts", () => {
    const key = issuePhotoKey(SURVEY, "IMG_4823.JPG");
    expect(key).toMatch(new RegExp(`^surveys/${SURVEY}/images/[0-9a-f-]{36}\\.jpg$`));
    expect(isIssuedPhotoKey(SURVEY, key)).toBe(true);
  });

  it("keeps a short lowercase extension, and turns an odd one into jpg", () => {
    expect(issuePhotoKey(SURVEY, "roof.webp")).toMatch(/\.webp$/);
    for (const odd of ["no-extension", "x./../../evil", "photo.j%pg", "a.toolongext", "trailing."]) {
      const key = issuePhotoKey(SURVEY, odd);
      expect(key).toMatch(/\.jpg$/);
      expect(isIssuedPhotoKey(SURVEY, key)).toBe(true);
    }
  });
});

describe("isIssuedPhotoKey (BL-064 / SPEC-028 A1)", () => {
  it("accepts only this survey's issued form", () => {
    expect(isIssuedPhotoKey(SURVEY, `surveys/${SURVEY}/images/${UUID}.jpg`)).toBe(true);
  });

  it.each([
    ["another survey's photo", `surveys/${OTHER}/images/${UUID}.jpg`],
    ["a key outside surveys/", `private/${UUID}.jpg`],
    ["the survey's report PDF", `surveys/${SURVEY}/report.pdf`],
    ["a path climbing out with ..", `surveys/${SURVEY}/images/../../${OTHER}/images/${UUID}.jpg`],
    ["an extra folder", `surveys/${SURVEY}/images/x/${UUID}.jpg`],
    ["something appended", `surveys/${SURVEY}/images/${UUID}.jpg/extra`],
    ["a name that is not a UUID", `surveys/${SURVEY}/images/a.jpg`],
    ["an empty key", ""],
  ])("refuses %s", (_what, key) => {
    expect(isIssuedPhotoKey(SURVEY, key)).toBe(false);
  });
});
