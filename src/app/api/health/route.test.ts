import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const mockReportError = vi.fn();
const checks = { sharp: vi.fn(), pdf: vi.fn(), database: vi.fn() };
vi.mock("@/lib/monitoring", () => ({ reportError: (...a: unknown[]) => mockReportError(...a) }));
vi.mock("@/lib/healthCheck", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/healthCheck")>()),
  LAUNCH_CHECKS: checks,
}));

const { GET, dynamic } = await import("./route");

beforeEach(() => {
  mockReportError.mockReset();
  for (const c of Object.values(checks)) c.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/health (BL-083 / SPEC-031)", () => {
  it("A3: answers 200 with every check ok, never cached", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(dynamic).toBe("force-dynamic");
    expect(await res.json()).toEqual({ status: "ok", checks: { sharp: "ok", pdf: "ok", database: "ok" } });
  });

  it("A3/B1: answers 503 naming a failed check, and reports it to Sentry by name", async () => {
    checks.sharp.mockRejectedValue(new Error("libvips-cpp.so missing"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "failed", checks: { sharp: "failed", pdf: "ok", database: "ok" } });
    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), { what: "health-check", check: "sharp" });
  });

  it("A2: never imports a checked library statically, so one that cannot load fails only its check", () => {
    for (const path of ["src/app/api/health/route.ts", "src/lib/healthCheck.ts"]) {
      const imports = readFileSync(path, "utf8").split("\n").filter((l) => l.startsWith("import "));
      expect(imports.filter((l) => /"sharp"|@\/lib\/pdf"|@\/lib\/prisma"/.test(l) && !l.startsWith("import type"))).toEqual([]);
    }
  });
});
