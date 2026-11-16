// The health check (BL-083 / SPEC-031). It loads the parts of SkyVault that
// failed silently on 2026-11-16, when sharp could not load on Vercel and report
// approval crashed before any code ran. Each check loads its own library with
// import(), so a library that cannot load fails only its own check instead of
// the whole route. The answer is minimal: names and ok/failed, nothing more.
import type { ReportAnalysis } from "@/lib/claude";

export type CheckName = "sharp" | "pdf" | "database";
export type CheckState = "ok" | "failed";
export type HealthResult = {
  httpStatus: 200 | 503;
  body: { status: CheckState; checks: Record<string, CheckState> };
};
type Check = () => Promise<unknown>;

/** Runs every check, even when some fail, and reports each failure by name. */
export async function runHealthChecks(
  checks: Record<string, Check>,
  report: (error: unknown, check: string) => void
): Promise<HealthResult> {
  const names = Object.keys(checks);
  const outcomes = await Promise.allSettled(names.map((name) => checks[name]()));
  const states: Record<string, CheckState> = {};
  outcomes.forEach((outcome, i) => {
    states[names[i]] = outcome.status === "fulfilled" ? "ok" : "failed";
    if (outcome.status === "rejected") report(outcome.reason, names[i]);
  });
  const allOk = Object.values(states).every((s) => s === "ok");
  return { httpStatus: allOk ? 200 : 503, body: { status: allOk ? "ok" : "failed", checks: states } };
}

const EMPTY_REPORT: ReportAnalysis = {
  condition_score: 10,
  defects: [],
  estimated_remaining_life_years: null,
  recommendations: [],
  urgent_action_required: false,
  confidence: "high",
  surveyor_notes: "Health check.",
  review_flags: [],
};

/** The three launch checks, each loading its own library. */
export const LAUNCH_CHECKS: Record<CheckName, Check> = {
  sharp: async () => {
    const { default: sharp } = await import("sharp");
    const image = sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 0, g: 0, b: 0 } } });
    await image.resize(1, 1).png().toBuffer();
  },
  pdf: async () => {
    const { renderReportPDF } = await import("@/lib/pdf");
    await renderReportPDF(EMPTY_REPORT, "Health check", "AA1 1AA");
  },
  database: async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
  },
};
