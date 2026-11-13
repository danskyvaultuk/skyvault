import { describe, it, expect, vi, beforeEach } from "vitest";
import { ANALYSIS_LIMIT } from "@/lib/analysisLimit";

const mockAuth = vi.fn();
const mockSurveyFindUnique = vi.fn();
const mockSurveyCount = vi.fn();
const mockSurveyUpdateMany = vi.fn();
const mockPipeline = vi.fn();
const mockWaitUntil = vi.fn();
const mockReportError = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    survey: {
      findUnique: (...args: unknown[]) => mockSurveyFindUnique(...args),
      count: (...args: unknown[]) => mockSurveyCount(...args),
      updateMany: (...args: unknown[]) => mockSurveyUpdateMany(...args),
    },
  },
}));
vi.mock("@/lib/pipeline", () => ({ runAnalysisPipeline: (...args: unknown[]) => mockPipeline(...args) }));
vi.mock("@vercel/functions", () => ({ waitUntil: (p: Promise<unknown>) => mockWaitUntil(p) }));
vi.mock("@/lib/monitoring", () => ({ reportError: (...args: unknown[]) => mockReportError(...args) }));

const { POST } = await import("./route");

function analyse() {
  return POST(new Request("http://localhost/api/surveys/survey-1/analyse", { method: "POST" }), {
    params: Promise.resolve({ id: "survey-1" }),
  });
}

// The background work handed to waitUntil, so a test can wait for it to settle.
function background(): Promise<unknown> {
  return mockWaitUntil.mock.calls[0][0];
}

function survey(over: Record<string, unknown> = {}) {
  return {
    id: "survey-1",
    customerId: "cust-1",
    status: "draft",
    updatedAt: new Date(),
    images: [{ id: "img-1" }],
    report: null,
    ...over,
  };
}

beforeEach(() => {
  mockAuth.mockReset().mockResolvedValue({ user: { id: "cust-1", role: "customer" } });
  mockSurveyFindUnique.mockReset().mockResolvedValue(survey());
  mockSurveyCount.mockReset().mockResolvedValue(0);
  mockSurveyUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  mockPipeline.mockReset().mockResolvedValue({ id: "report-1" });
  mockWaitUntil.mockReset();
  mockReportError.mockReset();
});

describe("POST /api/surveys/[id]/analyse", () => {
  it("at the limit: 429, nothing claimed, pipeline not called", async () => {
    mockSurveyCount.mockResolvedValue(ANALYSIS_LIMIT);
    const res = await analyse();
    expect(res.status).toBe(429);
    expect(mockSurveyUpdateMany).not.toHaveBeenCalled();
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("an admin caller is counted against the survey owner, not the admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    mockSurveyCount.mockImplementation(async ({ where }: { where: { customerId: string } }) =>
      where.customerId === "cust-1" ? ANALYSIS_LIMIT : 0
    );
    const res = await analyse();
    expect(res.status).toBe(429);
    expect(mockPipeline).not.toHaveBeenCalled();
    expect(mockSurveyCount.mock.calls[0][0].where.customerId).toBe("cust-1");
    expect(mockSurveyCount.mock.calls[0][0].where.customerId).not.toBe("admin-1");
  });

  it("one below the limit: counts, then claims, then starts the pipeline once in the background", async () => {
    mockSurveyCount.mockResolvedValue(ANALYSIS_LIMIT - 1);
    const res = await analyse();
    expect(res.status).toBe(202);
    expect(mockSurveyUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "survey-1",
        OR: [{ status: { in: ["draft", "pending"] } }, { status: "analysing", updatedAt: { lt: expect.any(Date) } }],
      },
      data: { status: "analysing" },
    });
    expect(mockSurveyUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockPipeline).toHaveBeenCalledTimes(1);
    expect(mockPipeline).toHaveBeenCalledWith("survey-1");
    expect(mockWaitUntil).toHaveBeenCalledTimes(1);
    const count = mockSurveyCount.mock.invocationCallOrder[0];
    const claim = mockSurveyUpdateMany.mock.invocationCallOrder[0];
    const run = mockPipeline.mock.invocationCallOrder[0];
    expect(count).toBeLessThan(claim);
    expect(claim).toBeLessThan(run);
  });

  it("starts analysis when the checklist's side slopes and other-roof photos are missing (BL-076 / SPEC-023 A2)", async () => {
    // Only front and back photos: no side, no secondary_roof. Missing checklist shots warn on the page; they never block.
    mockSurveyFindUnique.mockResolvedValue(
      survey({ images: [{ id: "img-1", roofParts: ["front"] }, { id: "img-2", roofParts: ["back"] }] })
    );
    const res = await analyse();
    expect(res.status).toBe(202);
    await background();
    expect(mockPipeline).toHaveBeenCalledTimes(1);
  });

  it("answers 202 at once, without waiting for the pipeline (BL-023)", async () => {
    let finish: () => void = () => {};
    mockPipeline.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const res = await analyse();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: "analysing" });
    finish();
    await background();
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it("a claim that changes no row: 400, pipeline not called", async () => {
    mockSurveyUpdateMany.mockResolvedValue({ count: 0 });
    const res = await analyse();
    expect(res.status).toBe(400);
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("a draft survey that has a report: 409, pipeline not called", async () => {
    mockSurveyFindUnique.mockResolvedValue(survey({ report: { id: "report-9" } }));
    const res = await analyse();
    expect(res.status).toBe(409);
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it.each([
    ["no session", { auth: null }, 401],
    ["another customer's survey", { found: survey({ customerId: "cust-2" }) }, 403],
    ["a missing survey", { found: null }, 404],
    ["a survey in a status past pending", { found: survey({ status: "complete" }) }, 400],
    ["a survey already analysing", { found: survey({ status: "analysing" }) }, 400],
    ["a survey with no images", { found: survey({ images: [] }) }, 400],
  ])("starts nothing for %s", async (_label, setup: { auth?: null; found?: unknown }, status) => {
    if ("auth" in setup) mockAuth.mockResolvedValue(setup.auth);
    if ("found" in setup) mockSurveyFindUnique.mockResolvedValue(setup.found);
    const res = await analyse();
    expect(res.status).toBe(status);
    expect(mockPipeline).not.toHaveBeenCalled();
    expect(mockSurveyUpdateMany).not.toHaveBeenCalled();
    expect(mockWaitUntil).not.toHaveBeenCalled();
  });

  it("a pipeline failure in the background: reports it with the survey id and reverts analysing to failed (SPEC-020 B2, BL-071)", async () => {
    const failure = new Error("Survey has no images to analyse");
    mockPipeline.mockRejectedValue(failure);
    const res = await analyse();
    expect(res.status).toBe(202);
    await background();
    expect(mockReportError).toHaveBeenCalledWith(failure, { what: "analysis-failed", surveyId: "survey-1" });
    expect(mockSurveyUpdateMany).toHaveBeenLastCalledWith({
      where: { id: "survey-1", status: "analysing" },
      data: { status: "failed" },
    });
  });

  it("the revert itself rejecting still settles the background work, and the failure is still reported", async () => {
    mockPipeline.mockRejectedValue(new Error("model unavailable"));
    mockSurveyUpdateMany.mockResolvedValueOnce({ count: 1 }).mockRejectedValueOnce(new Error("db unavailable"));
    const res = await analyse();
    expect(res.status).toBe(202);
    await expect(background()).resolves.toBeUndefined();
    expect(mockReportError).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/surveys/[id]/analyse — an analysis that stopped (BL-066 / SPEC-021 E2)", () => {
  const MINUTE = 60 * 1000;

  it("accepts a retry of a survey analysing for over 10 minutes", async () => {
    mockSurveyFindUnique.mockResolvedValue(survey({ status: "analysing", updatedAt: new Date(Date.now() - 11 * MINUTE) }));
    const res = await analyse();
    expect(res.status).toBe(202);
    expect(mockPipeline).toHaveBeenCalledWith("survey-1");
    const cutoff = mockSurveyUpdateMany.mock.calls[0][0].where.OR[1].updatedAt.lt as Date;
    expect(Math.abs(Date.now() - 10 * MINUTE - cutoff.getTime())).toBeLessThan(5000);
  });

  it("still refuses a survey analysing for under 10 minutes", async () => {
    mockSurveyFindUnique.mockResolvedValue(survey({ status: "analysing", updatedAt: new Date(Date.now() - 9 * MINUTE) }));
    const res = await analyse();
    expect(res.status).toBe(400);
    expect(mockSurveyUpdateMany).not.toHaveBeenCalled();
    expect(mockPipeline).not.toHaveBeenCalled();
  });
});
