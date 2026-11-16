import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("Sign out at once everywhere (BL-078 / SPEC-027 F1, SEED-027)", () => {
  it("no page or component links to the sign-out confirmation page", () => {
    const linking = [...sourceFiles("src/app"), ...sourceFiles("src/components")].filter((f) =>
      readFileSync(f, "utf8").includes("/api/auth/signout")
    );
    expect(linking).toEqual([]);
  });

  it.each([
    "src/app/(customer)/layout.tsx",
    "src/components/mobile-nav.tsx",
    "src/app/admin/layout.tsx",
    "src/app/roofer/layout.tsx",
    "src/app/drone/layout.tsx",
    "src/app/unavailable/page.tsx",
  ])("%s signs out with the one-click button", (path) => {
    expect(readFileSync(path, "utf8")).toContain("<SignOutButton");
  });
});
