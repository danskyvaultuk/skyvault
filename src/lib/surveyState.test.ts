import { describe, it, expect } from "vitest";
import { effectiveSurveyStatus, isStaleAnalysis, STALE_ANALYSIS_MS, staleAnalysisCutoff } from "./surveyState";

const NOW = new Date("2026-11-13T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("isStaleAnalysis", () => {
  it("is 10 minutes", () => {
    expect(STALE_ANALYSIS_MS).toBe(10 * 60 * 1000);
  });

  it("is true for a survey analysing for over 10 minutes", () => {
    expect(isStaleAnalysis({ status: "analysing", updatedAt: ago(STALE_ANALYSIS_MS + 1) }, NOW)).toBe(true);
  });

  it("is false for a survey analysing for under 10 minutes", () => {
    expect(isStaleAnalysis({ status: "analysing", updatedAt: ago(STALE_ANALYSIS_MS - 1000) }, NOW)).toBe(false);
  });

  it("is false for any other status, however old", () => {
    expect(isStaleAnalysis({ status: "draft", updatedAt: ago(STALE_ANALYSIS_MS * 10) }, NOW)).toBe(false);
  });

  it("accepts the date as JSON text, as the page receives it", () => {
    expect(isStaleAnalysis({ status: "analysing", updatedAt: ago(STALE_ANALYSIS_MS * 2).toISOString() }, NOW)).toBe(true);
  });
});

describe("effectiveSurveyStatus and staleAnalysisCutoff", () => {
  it("shows a stale analysis as failed and leaves a fresh one alone", () => {
    expect(effectiveSurveyStatus({ status: "analysing", updatedAt: ago(STALE_ANALYSIS_MS * 2) }, NOW)).toBe("failed");
    expect(effectiveSurveyStatus({ status: "analysing", updatedAt: ago(1000) }, NOW)).toBe("analysing");
  });

  it("puts the cutoff 10 minutes before now", () => {
    expect(staleAnalysisCutoff(NOW)).toEqual(ago(STALE_ANALYSIS_MS));
  });
});
