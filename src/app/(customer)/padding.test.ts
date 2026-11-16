import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name === "page.tsx" ? [path] : [];
  });
}

describe("phone padding on the customer pages (BL-078 / SPEC-027 C3)", () => {
  it("no customer page keeps a bare p-8; each uses smaller padding on phones and p-8 from tablet width", () => {
    const bare = pages("src/app/(customer)").filter((f) => /(^|["\s])p-8(?=[\s"])/.test(readFileSync(f, "utf8")));
    expect(bare).toEqual([]);
  });

  it.each([
    "src/app/(customer)/dashboard/page.tsx",
    "src/app/(customer)/properties/new/page.tsx",
    "src/app/(customer)/properties/[id]/page.tsx",
    "src/app/(customer)/surveys/new/page.tsx",
    "src/app/(customer)/surveys/[id]/page.tsx",
    "src/app/(customer)/surveys/[id]/report/page.tsx",
  ])("%s, which had a bare p-8, uses p-4 md:p-8", (path) => {
    expect(readFileSync(path, "utf8")).toContain("p-4 md:p-8");
  });
});
