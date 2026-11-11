import { describe, it, expect, vi, beforeEach } from "vitest";
import { ANALYSIS_LIMIT } from "@/lib/analysisLimit";

const mockAuth = vi.fn();
const mockSurveyFindUnique = vi.fn();
const mockSurveyCount = vi.fn();
const mockSurveyUpdateMany = vi.fn();
const mockPipeline = vi.fn();

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

const { POST } = await import("./route");

function analyse() {
  return POST(new Request("http://localhost/api/surveys/survey-1/analyse", { method: "POST" }), {
    params: Promise.resolve({ id: "survey-1" }),
  });
}

function survey(over: Record<string, unknown> = {}) {
  return { id: "survey-1", customerId: "cust-1", status: "draft", images: [{ id: "img-1" }], report: null, ...over };
}

beforeEach(() => {
  mockAuth.mockReset().mockResolvedValue({ user: { id: "cust-1", role: "customer" } });
  mockSurveyFindUnique.mockReset().mockResolvedValue(survey());
  mockSurveyCount.mockReset().mockResolvedValue(0);
  mockSurveyUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  mockPipeline.mockReset().mockResolvedValue({ id: "report-1" });
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

  it("one below the limit: counts, then claims, then runs the pipeline once", async () => {
    mockSurveyCount.mockResolvedValue(ANALYSIS_LIMIT - 1);
    const res = await analyse();
    expect(res.status).toBe(200);
    expect(mockSurveyUpdateMany).toHaveBeenCalledWith({
      where: { id: "survey-1", status: { in: ["draft", "pending"] } },
      data: { status: "analysing" },
    });
    expect(mockPipeline).toHaveBeenCalledTimes(1);
    expect(mockPipeline).toHaveBeenCalledWith("survey-1");
    const count = mockSurveyCount.mock.invocationCallOrder[0];
    const claim = mockSurveyUpdateMany.mock.invocationCallOrder[0];
    const run = mockPipeline.mock.invocationCallOrder[0];
    expect(count).toBeLessThan(claim);
    expect(claim).toBeLessThan(run);
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

  it("another customer's survey: 403", async () => {
    mockSurveyFindUnique.mockResolvedValue(survey({ customerId: "cust-2" }));
    const res = await analyse();
    expect(res.status).toBe(403);
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("no session: 401", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await analyse();
    expect(res.status).toBe(401);
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("missing survey: 404", async () => {
    mockSurveyFindUnique.mockResolvedValue(null);
    const res = await analyse();
    expect(res.status).toBe(404);
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("a survey in a status past pending: 400", async () => {
    mockSurveyFindUnique.mockResolvedValue(survey({ status: "complete" }));
    const res = await analyse();
    expect(res.status).toBe(400);
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("a survey with no images: 400", async () => {
    mockSurveyFindUnique.mockResolvedValue(survey({ images: [] }));
    const res = await analyse();
    expect(res.status).toBe(400);
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("a pipeline throw after the claim: reverts analysing to failed, then 500", async () => {
    mockPipeline.mockRejectedValue(new Error("model unavailable"));
    const res = await analyse();
    expect(res.status).toBe(500);
    expect(mockSurveyUpdateMany).toHaveBeenLastCalledWith({
      where: { id: "survey-1", status: "analysing" },
      data: { status: "failed" },
    });
  });

  it("the revert itself rejecting still answers 500", async () => {
    mockPipeline.mockRejectedValue(new Error("model unavailable"));
    mockSurveyUpdateMany.mockResolvedValueOnce({ count: 1 }).mockRejectedValueOnce(new Error("db unavailable"));
    const res = await analyse();
    expect(res.status).toBe(500);
  });
});
