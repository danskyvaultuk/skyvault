import { describe, expect, it, vi } from "vitest";
import { runHealthChecks, LAUNCH_CHECKS } from "./healthCheck";

const ok = () => vi.fn(async () => undefined);
const fails = (message = "boom") => vi.fn(async () => { throw new Error(message); });

describe("runHealthChecks (BL-083 / SPEC-031 A2, A3, B1)", () => {
  it("A3: answers 200 with every check ok, and reports nothing", async () => {
    const report = vi.fn();
    const result = await runHealthChecks({ sharp: ok(), pdf: ok(), database: ok() }, report);
    expect(result).toEqual({ httpStatus: 200, body: { status: "ok", checks: { sharp: "ok", pdf: "ok", database: "ok" } } });
    expect(report).not.toHaveBeenCalled();
  });

  it.each(["sharp", "pdf", "database"])("A2/A3: %s failing alone gives 503 with only it failed, the others still run", async (failing) => {
    const checks = { sharp: ok(), pdf: ok(), database: ok() } as Record<string, ReturnType<typeof vi.fn>>;
    checks[failing] = fails();
    const result = await runHealthChecks(checks, vi.fn());
    expect(result.httpStatus).toBe(503);
    expect(result.body.status).toBe("failed");
    for (const [name, check] of Object.entries(checks)) {
      expect(check).toHaveBeenCalledTimes(1);
      expect(result.body.checks[name]).toBe(name === failing ? "failed" : "ok");
    }
  });

  it("A2: a library that throws while loading counts as its check failing", async () => {
    const loadFailure = vi.fn(async () => {
      throw new Error('Failed to load external module sharp-x: Could not load the "sharp" module using the linux-x64 runtime');
    });
    const result = await runHealthChecks({ sharp: loadFailure, pdf: ok(), database: ok() }, vi.fn());
    expect(result.body.checks).toEqual({ sharp: "failed", pdf: "ok", database: "ok" });
  });

  it("A3: the answer holds only status and checks, never error text", async () => {
    const result = await runHealthChecks({ sharp: fails("secret detail"), pdf: ok(), database: ok() }, vi.fn());
    expect(Object.keys(result.body)).toEqual(["status", "checks"]);
    expect(JSON.stringify(result.body)).not.toContain("secret detail");
  });

  it("B1: reports each failing check once, by name, with its error", async () => {
    const report = vi.fn();
    await runHealthChecks({ sharp: fails("a"), pdf: ok(), database: fails("b") }, report);
    expect(report).toHaveBeenCalledTimes(2);
    expect(report.mock.calls.map(([e, name]) => [name, (e as Error).message])).toEqual([["sharp", "a"], ["database", "b"]]);
  });
});

describe("LAUNCH_CHECKS (BL-083 / SPEC-031 A2)", () => {
  it("are the sharp, pdf and database checks", () => {
    expect(Object.keys(LAUNCH_CHECKS)).toEqual(["sharp", "pdf", "database"]);
  });

  it("the sharp check really loads sharp and resizes an image", async () => {
    await expect(LAUNCH_CHECKS.sharp()).resolves.toBeUndefined();
  });

  it("the pdf check really renders a report PDF", async () => {
    await expect(LAUNCH_CHECKS.pdf()).resolves.toBeUndefined();
  }, 30000);
});
