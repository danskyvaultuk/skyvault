// Limits how many surveys one customer can send to the paid analysis pipeline
// in a rolling window (BL-013). The count is derived from survey rows because a
// Vercel serverless function holds no memory between invocations, so an
// in-process counter would limit nothing.
import { prisma } from "@/lib/prisma";

export const ANALYSIS_LIMIT = 5;
export const ANALYSIS_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The surveys that count towards the limit: sent for analysis within the window. Shared with the admin dashboard (BL-080). */
export function analysesInWindow(now: Date = new Date()) {
  return {
    status: { in: ["analysing" as const, "complete" as const, "failed" as const] },
    updatedAt: { gte: new Date(now.getTime() - ANALYSIS_WINDOW_MS) },
  };
}

export async function analysisLimitReached(customerId: string, now: Date = new Date()): Promise<boolean> {
  const used = await prisma.survey.count({ where: { customerId, ...analysesInWindow(now) } });
  return used >= ANALYSIS_LIMIT;
}
