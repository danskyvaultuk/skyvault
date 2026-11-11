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
      priority: "low",
      category: "cosmetic",
      extent: "moderate",
      location: "upper half of the photo, across the tiles",
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

describe("analyzeRoof — photo labels (BL-021)", () => {
  async function promptFor(labels: Parameters<typeof analyzeRoof>[4]) {
    mockClaudeReturns(VALID_RESPONSE_JSON);
    await analyzeRoof(["a", "b", "c"], ["image/jpeg", "image/jpeg", "image/jpeg"], undefined, null, labels);
    const call = mockCreate.mock.calls[0][0];
    return { text: call.messages[0].content.at(-1).text as string, system: call.system as string };
  }

  it("lists each labelled photo by its 0-based index and leaves out unlabelled ones", async () => {
    const { text } = await promptFor([["ridge"], [], ["chimney", "flashing"]]);
    expect(text).toContain("<photo_labels>\nImage 0: ridge\nImage 2: chimney, flashing\n</photo_labels>");
    expect(text).not.toContain("Image 1:");
  });

  it("omits the block when no photo is labelled", async () => {
    expect((await promptFor([[], [], []])).text).not.toContain("<photo_labels>");
    expect((await promptFor(undefined)).text).not.toContain("<photo_labels>");
  });

  it("explains the labels in the system prompt as customer hints grounded in the images", async () => {
    const { system } = await promptFor([["front"], [], []]);
    expect(system).toContain("<photo_labels>");
    expect(system).toContain("customer-supplied");
    expect(system).toContain('"condition_score": <integer 1–10, where 10 = perfect new roof>');
  });
});

describe("analyzeRoof — defect priority, location and the rubric (BL-003 / BL-009)", () => {
  const withDefect = (defect: Record<string, unknown>, score = 8) => ({
    ...VALID_RESPONSE_JSON,
    condition_score: score,
    defects: [defect],
  });
  const FUNCTIONAL = {
    type: "flashing_damage",
    severity: "high",
    description: "Lifted lead flashing at the chimney",
    image_index: 1,
    priority: "urgent",
    category: "functional",
    extent: "small",
    location: "right of the chimney, at the base",
  };

  it("parses a defect carrying priority, category, extent and location", async () => {
    mockClaudeReturns(withDefect({ ...FUNCTIONAL, priority: "medium" }, 6));
    const result = await analyzeRoof(["a", "b"], ["image/jpeg", "image/jpeg"]);
    expect(result.defects[0]).toMatchObject({ priority: "medium", category: "functional", extent: "small" });
  });

  it.each(["priority", "category", "extent", "location"])("refuses a defect missing %s", async (field) => {
    const defect: Record<string, unknown> = { ...FUNCTIONAL };
    delete defect[field];
    mockClaudeReturns(withDefect(defect));
    await expect(analyzeRoof(["a", "b"], ["image/jpeg", "image/jpeg"])).rejects.toThrow();
  });

  it("returns the score capped, keeping the AI's own score", async () => {
    mockClaudeReturns(withDefect(FUNCTIONAL, 8));
    const result = await analyzeRoof(["a", "b"], ["image/jpeg", "image/jpeg"]);
    expect(result.condition_score).toBe(3);
    expect(result.ai_condition_score).toBe(8);
  });

  it("carries the rubric, the new fields and the location rule in the system prompt", async () => {
    mockClaudeReturns(VALID_RESPONSE_JSON);
    await analyzeRoof(["a"], ["image/jpeg"]);
    const system = mockCreate.mock.calls[0][0].system as string;
    for (let score = 1; score <= 10; score++) expect(system).toMatch(new RegExp(`\\n  ${score} = `));
    expect(system).toContain('"priority": "<low|medium|high|urgent');
    expect(system).toContain('"category": "<cosmetic|functional');
    expect(system).toContain('"extent": "<small|moderate|large');
    expect(system).toContain('"location":');
    expect(system).toMatch(/never state a slope as measured/i);
    expect(system).toContain('"type": "<missing_tiles|cracked_tiles|moss_growth|flashing_damage|gutter_damage|ridge_damage|valley_damage|other>"');
  });
});
