// Limits how many surveys one customer can create in a rolling window
// (BL-066 / SPEC-021 C3), so a script cannot fill the database. Counted from
// survey rows, like the analysis limit, because a serverless function keeps
// no memory between requests.
import { prisma } from "@/lib/prisma";

export const SURVEY_CREATION_LIMIT = 5;
export const SURVEY_CREATION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The surveys that count towards the limit: created within the window. Shared with the admin dashboard (BL-080). */
export function surveysCreatedInWindow(now: Date = new Date()) {
  return { createdAt: { gte: new Date(now.getTime() - SURVEY_CREATION_WINDOW_MS) } };
}

export async function surveyCreationLimitReached(customerId: string, now: Date = new Date()): Promise<boolean> {
  const created = await prisma.survey.count({ where: { customerId, ...surveysCreatedInWindow(now) } });
  return created >= SURVEY_CREATION_LIMIT;
}
