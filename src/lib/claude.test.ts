import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// Imported after the mock so the module picks up the mocked SDK.
const { analyzeRoof } = await import("./claude");

const VALID_RESPONSE_JSON = {
  condition_score: 7,
  defects: [
    {
      type: "moss_growth",
      severity: "low",
      description: "Light moss on north-facing slope",
      image_index: 0,
    },
  ],
  estimated_remaining_life_years: 15,
  recommendations: ["Clear moss before next winter"],
  urgent_action_required: false,
  confidence: "high",
  surveyor_notes: "Overall in good condition.",
};

function mockClaudeReturns(json: object) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(json) }],
  });
}

beforeEach(() => {
  mockCreate.mockReset();
});

describe("analyzeRoof — roof context prompt injection", () => {
  it("omits the <roof_context> block entirely when no context is passed", async () => {
    mockClaudeReturns(VALID_RESPONSE_JSON);
    await analyzeRoof(["base64img"], ["image/jpeg"], undefined, null);

    const call = mockCreate.mock.calls[0][0];
    const promptText = call.messages[0].content.at(-1).text as string;
    expect(promptText).not.toContain("<roof_context>");
  });

  it("omits the block when context is an empty object (customer skipped everything)", async () => {
    mockClaudeReturns(VALID_RESPONSE_JSON);
    await analyzeRoof(["base64img"], ["image/jpeg"], undefined, {});

    const call = mockCreate.mock.calls[0][0];
    const promptText = call.messages[0].content.at(-1).text as string;
    expect(promptText).not.toContain("<roof_context>");
  });

  it("includes the block with only the answered fields when context is partially filled", async () => {
    mockClaudeReturns(VALID_RESPONSE_JSON);
    await analyzeRoof(["base64img"], ["image/jpeg"], undefined, { material: "felt" });

    const call = mockCreate.mock.calls[0][0];
    const promptText = call.messages[0].content.at(-1).text as string;
    expect(promptText).toContain("<roof_context>");
    expect(promptText).toContain("Material: felt");
    expect(promptText).not.toContain("Roof age");
  });

  it("includes both <customer_notes> and <roof_context> together when both are present", async () => {
    mockClaudeReturns(VALID_RESPONSE_JSON);
    await analyzeRoof(["base64img"], ["image/jpeg"], "Worried about the chimney", {
      material: "slate",
    });

    const call = mockCreate.mock.calls[0][0];
    const promptText = call.messages[0].content.at(-1).text as string;
    expect(promptText).toContain("<customer_notes>");
    expect(promptText).toContain("<roof_context>");
  });
});

describe("analyzeRoof — schema/parsing contract (regression guard)", () => {
  // These lock in the guarantee that the roof-context prompt addition does not
  // touch the JSON schema Claude is asked to return, or how the response is parsed.
  // If this test ever fails, the failure is in the schema/parsing path — not the
  // roof-context feature — and must be treated as a real regression.

  it("the system prompt still contains the unmodified response schema", async () => {
    mockClaudeReturns(VALID_RESPONSE_JSON);
    await analyzeRoof(["base64img"], ["image/jpeg"]);

    const call = mockCreate.mock.calls[0][0];
    const systemPrompt = call.system as string;

    // Exact schema fragment — any drift here means the schema block itself changed.
    expect(systemPrompt).toContain('"condition_score": <integer 1–10, where 10 = perfect new roof>');
    expect(systemPrompt).toContain('"estimated_remaining_life_years": <integer or null if unable to estimate>');
    expect(systemPrompt).toContain('"confidence": "<low|medium|high — based on image quality and coverage>');
    expect(systemPrompt).toContain("Return ONLY valid JSON matching this exact schema — no markdown, no prose, no explanation:");
  });

  it("produces an identical parsed result for the same Claude response, with or without roof context", async () => {
    mockClaudeReturns(VALID_RESPONSE_JSON);
    const withoutContext = await analyzeRoof(["base64img"], ["image/jpeg"], undefined, null);

    mockClaudeReturns(VALID_RESPONSE_JSON);
    const withContext = await analyzeRoof(["base64img"], ["image/jpeg"], undefined, {
      material: "tile",
      ageBand: "5-15",
    });

    // Same upstream response → same validated shape, regardless of prompt additions.
    expect(withContext).toEqual(withoutContext);
  });

  it("still throws on a schema-invalid response, unaffected by roof context", async () => {
    mockClaudeReturns({ condition_score: "not-a-number" });
    await expect(
      analyzeRoof(["base64img"], ["image/jpeg"], undefined, { material: "slate" })
    ).rejects.toThrow(/failed validation/);
  });
});
