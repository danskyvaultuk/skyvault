import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockSurveyFindUnique = vi.fn();
const mockSurveyUpdate = vi.fn();
const mockRunPipeline = vi.fn();
const mockWaitUntil = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    survey: {
      findUnique: (...args: unknown[]) => mockSurveyFindUnique(...args),
      update: (...args: unknown[]) => mockSurveyUpdate(...args),
    },
  },
}));
vi.mock("@/lib/pipeline", () => ({ runAnalysisPipeline: (...args: unknown[]) => mockRunPipeline(...args) }));
vi.mock("@vercel/functions", () => ({ waitUntil: (p: Promise<unknown>) => mockWaitUntil(p) }));

const { POST } = await import("./route");

const OWNER = { user: { id: "cust-1", role: "customer" } };
const STRANGER = { user: { id: "cust-2", role: "customer" } };

function survey(overrides: Record<string, unknown> = {}) {
  return { id: "survey-1", customerId: "cust-1", status: "draft", images: [{ id: "img-1" }], ...overrides };
}

async function post(session: unknown, found: unknown) {
  mockAuth.mockResolvedValue(session);
  mockSurveyFindUnique.mockResolvedValue(found);
  return POST(new Request("http://localhost/api/surveys/survey-1/analyse", { method: "POST" }), {
    params: Promise.resolve({ id: "survey-1" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSurveyUpdate.mockResolvedValue({});
});

describe("POST /api/surveys/[id]/analyse — background analysis (BL-023)", () => {
  it("answers 202 at once, marks the survey analysing and starts the pipeline without waiting for it", async () => {
    let finish: () => void = () => {};
    mockRunPipeline.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));

    const res = await post(OWNER, survey());

    expect(res.status).toBe(202);
    expect(mockSurveyUpdate).toHaveBeenCalledWith({ where: { id: "survey-1" }, data: { status: "analysing" } });
    expect(mockRunPipeline).toHaveBeenCalledWith("survey-1");
    expect(mockWaitUntil).toHaveBeenCalledTimes(1);
    finish();
  });

  it.each([
    ["not signed in", null, survey(), 401],
    ["not the owner", STRANGER, survey(), 403],
    ["already analysing", OWNER, survey({ status: "analysing" }), 400],
    ["no photos", OWNER, survey({ images: [] }), 400],
    ["unknown survey", OWNER, null, 404],
  ])("starts nothing when %s", async (_label, session, found, status) => {
    const res = await post(session, found);
    expect(res.status).toBe(status);
    expect(mockRunPipeline).not.toHaveBeenCalled();
    expect(mockSurveyUpdate).not.toHaveBeenCalled();
  });

  it("logs a failure in the background", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRunPipeline.mockRejectedValue(new Error("Claude declined to analyse these photos (refusal)"));

    await post(OWNER, survey());
    await mockWaitUntil.mock.calls[0][0];

    expect(error).toHaveBeenCalledWith(expect.stringContaining("survey-1"), expect.any(Error));
    error.mockRestore();
  });
});
