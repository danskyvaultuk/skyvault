import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSurveyCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { survey: { count: (...args: unknown[]) => mockSurveyCount(...args) } },
}));

const { ANALYSIS_LIMIT, ANALYSIS_WINDOW_MS, analysisLimitReached } = await import("./analysisLimit");

const NOW = new Date("2026-06-15T12:00:00.000Z");

beforeEach(() => {
  mockSurveyCount.mockReset();
});

describe("analysisLimitReached", () => {
  it("is reached when the count equals the limit", async () => {
    mockSurveyCount.mockResolvedValue(ANALYSIS_LIMIT);
    expect(await analysisLimitReached("cust-1", NOW)).toBe(true);
  });

  it("is reached when the count is above the limit", async () => {
    mockSurveyCount.mockResolvedValue(ANALYSIS_LIMIT + 1);
    expect(await analysisLimitReached("cust-1", NOW)).toBe(true);
  });

  it("is not reached one below the limit", async () => {
    mockSurveyCount.mockResolvedValue(ANALYSIS_LIMIT - 1);
    expect(await analysisLimitReached("cust-1", NOW)).toBe(false);
  });

  it("counts the owner's surveys in analysing, complete or failed within the window", async () => {
    mockSurveyCount.mockResolvedValue(0);
    await analysisLimitReached("cust-1", NOW);
    expect(mockSurveyCount).toHaveBeenCalledTimes(1);
    const { where } = mockSurveyCount.mock.calls[0][0];
    expect(where.customerId).toBe("cust-1");
    expect(where.status).toEqual({ in: ["analysing", "complete", "failed"] });
    expect(where.updatedAt).toEqual({ gte: new Date(NOW.getTime() - ANALYSIS_WINDOW_MS) });
  });

  it("measures the window from the current time when none is given", async () => {
    mockSurveyCount.mockResolvedValue(0);
    const before = Date.now();
    await analysisLimitReached("cust-1");
    const after = Date.now();
    const since: Date = mockSurveyCount.mock.calls[0][0].where.updatedAt.gte;
    expect(since.getTime()).toBeGreaterThanOrEqual(before - ANALYSIS_WINDOW_MS);
    expect(since.getTime()).toBeLessThanOrEqual(after - ANALYSIS_WINDOW_MS);
  });
});
