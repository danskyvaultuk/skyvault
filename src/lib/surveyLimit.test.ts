import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSurveyCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { survey: { count: (...args: unknown[]) => mockSurveyCount(...args) } },
}));

const { SURVEY_CREATION_LIMIT, SURVEY_CREATION_WINDOW_MS, surveyCreationLimitReached } = await import("./surveyLimit");

const NOW = new Date("2026-06-15T12:00:00.000Z");

beforeEach(() => {
  mockSurveyCount.mockReset();
});

describe("surveyCreationLimitReached", () => {
  it("is 5 surveys per 24 hours", () => {
    expect(SURVEY_CREATION_LIMIT).toBe(5);
    expect(SURVEY_CREATION_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("is reached at 5 surveys created", async () => {
    mockSurveyCount.mockResolvedValue(5);
    expect(await surveyCreationLimitReached("cust-1", NOW)).toBe(true);
  });

  it("is not reached at 4, so the 5th is allowed", async () => {
    mockSurveyCount.mockResolvedValue(4);
    expect(await surveyCreationLimitReached("cust-1", NOW)).toBe(false);
  });

  it("counts the customer's surveys created in the last 24 hours", async () => {
    mockSurveyCount.mockResolvedValue(0);
    await surveyCreationLimitReached("cust-1", NOW);
    expect(mockSurveyCount.mock.calls[0][0].where).toEqual({
      customerId: "cust-1",
      createdAt: { gte: new Date(NOW.getTime() - SURVEY_CREATION_WINDOW_MS) },
    });
  });
});
