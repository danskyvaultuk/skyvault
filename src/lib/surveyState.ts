// When an `analysing` survey is really a failed one (BL-066 / SPEC-021 E2).
// A background analysis ends well inside the function's 180 s time limit, so
// a survey still `analysing` after 10 minutes was stopped without reaching its
// failure handler (for example by the platform's time limit). It is treated as
// failed, so the customer can retry it.

export const STALE_ANALYSIS_MS = 10 * 60 * 1000;

type SurveyState = { status: string; updatedAt: Date | string };

export function isStaleAnalysis(survey: SurveyState, now: Date = new Date()): boolean {
  if (survey.status !== "analysing") return false;
  return now.getTime() - new Date(survey.updatedAt).getTime() > STALE_ANALYSIS_MS;
}

/** The status a customer acts on: a stale analysis shows as failed. */
export function effectiveSurveyStatus(survey: SurveyState, now: Date = new Date()): string {
  return isStaleAnalysis(survey, now) ? "failed" : survey.status;
}

/** The moment before which an `analysing` survey counts as stale. */
export function staleAnalysisCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - STALE_ANALYSIS_MS);
}
