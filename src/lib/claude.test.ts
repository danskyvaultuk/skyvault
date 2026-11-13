import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
      zone: "none",
    },
  ],
  estimated_remaining_life_years: 15,
  recommendations: ["Clear moss before next winter"],
  urgent_action_required: false,
  confidence: "high",
  surveyor_notes: "Overall in good condition.",
  review_flags: [],
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

describe("analyzeRoof — the secondary_roof label (BL-076 / SPEC-023 C1)", () => {
  it("lists a secondary_roof photo in <photo_labels> and explains the label in the system prompt", async () => {
    mockClaudeReturns(VALID_RESPONSE_JSON);
    await analyzeRoof(["a", "b"], ["image/jpeg", "image/jpeg"], undefined, null, [["side"], ["secondary_roof"]]);
    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content.at(-1).text).toContain("<photo_labels>\nImage 0: side\nImage 1: secondary_roof\n</photo_labels>");
    const system = call.system as string;
    expect(system).toMatch(/secondary_roof[^.]*flat roof, dormer, bay window or porch roof/i);
    expect(system).toMatch(/secondary_roof[^.]*not the main roof slopes/i);
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
    zone: "protrusion",
  };

  it("parses a defect carrying priority, category, extent and location", async () => {
    mockClaudeReturns(withDefect({ ...FUNCTIONAL, priority: "medium" }, 6));
    const result = await analyzeRoof(["a", "b"], ["image/jpeg", "image/jpeg"]);
    expect(result.defects[0]).toMatchObject({ priority: "medium", category: "functional", extent: "small" });
  });

  it.each(["priority", "category", "extent", "location", "zone"])("refuses a defect missing %s", async (field) => {
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
    expect(system).toMatch(/Functional defects lower the score far\s+more than cosmetic ones/);
    expect(system).toContain('"description": "<max 150 chars describing location and extent>"');
    expect(system).toContain('"image_index": <0-based index of the image showing this defect>');
    expect(system).toContain('"type": "<missing_tiles|cracked_tiles|moss_growth|flashing_damage|gutter_damage|ridge_damage|valley_damage|other>"');
  });
});

describe("analyzeRoof — review flags and peripheral zones (BL-010 / BL-004)", () => {
  const SHADOW = { reason: "low_light", description: "Rear slope photo, upper half in shadow", image_index: 0 };

  it("parses an answer with review flags and a zoned defect", async () => {
    mockClaudeReturns({
      ...VALID_RESPONSE_JSON,
      defects: [{ ...VALID_RESPONSE_JSON.defects[0], type: "gutter_damage", zone: "drainage_point" }],
      review_flags: [SHADOW],
    });
    const result = await analyzeRoof(["a"], ["image/jpeg"]);
    expect(result.review_flags).toEqual([SHADOW]);
    expect(result.defects[0].zone).toBe("drainage_point");
  });

  it("refuses an answer missing the review flag list", async () => {
    const { review_flags: _omitted, ...withoutFlags } = VALID_RESPONSE_JSON;
    mockClaudeReturns(withoutFlags);
    await expect(analyzeRoof(["a"], ["image/jpeg"])).rejects.toThrow(/failed validation/);
  });

  it("refuses an unknown zone", async () => {
    mockClaudeReturns({ ...VALID_RESPONSE_JSON, defects: [{ ...VALID_RESPONSE_JSON.defects[0], zone: "attic" }] });
    await expect(analyzeRoof(["a"], ["image/jpeg"])).rejects.toThrow(/failed validation/);
  });

  it("adds a low_confidence flag to a low-confidence answer that raised none", async () => {
    mockClaudeReturns({ ...VALID_RESPONSE_JSON, confidence: "low", review_flags: [SHADOW] });
    const result = await analyzeRoof(["a"], ["image/jpeg"]);
    expect(result.review_flags.map((f) => f.reason)).toEqual(["low_light", "low_confidence"]);
  });

  it("names every peripheral zone and carries the flag and lighting guidance in the system prompt", async () => {
    mockClaudeReturns(VALID_RESPONSE_JSON);
    await analyzeRoof(["a"], ["image/jpeg"]);
    const system = mockCreate.mock.calls[0][0].system as string;
    for (const zone of ["eaves", "wall_junction", "fascia", "upstand", "drainage_point", "protrusion"]) {
      expect(system).toContain(`"${zone}"`);
    }
    for (const reason of ["low_confidence", "ambiguous", "unassessable_area", "low_light"]) {
      expect(system).toContain(`"${reason}"`);
    }
    expect(system).toContain('"review_flags": [{');
    expect(system).toContain('"zone": "<eaves|wall_junction|fascia|upstand|drainage_point|protrusion|none');
    expect(system).toMatch(/Shadow is not felt or a flat roof/);
    expect(system).toContain('"condition_score": <integer 1–10, where 10 = perfect new roof>');
  });
});

describe("analyzeRoof — the analysis model (BL-067)", () => {
  const ORIGINAL = process.env.SKYVAULT_ANALYSIS_MODEL;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SKYVAULT_ANALYSIS_MODEL;
    else process.env.SKYVAULT_ANALYSIS_MODEL = ORIGINAL;
  });

  it("asks Claude Opus 5.5 at high effort by default, with no sampling setting", async () => {
    delete process.env.SKYVAULT_ANALYSIS_MODEL;
    mockClaudeReturns(VALID_RESPONSE_JSON);
    await analyzeRoof(["a"], ["image/jpeg"]);
    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe("claude-opus-5-5");
    expect(call.output_config).toEqual({ effort: "high" });
    expect(call.max_tokens).toBeGreaterThanOrEqual(16000);
    expect(call).not.toHaveProperty("temperature");
  });

  it("uses the model setting, and sends no effort level to a model that rejects it", async () => {
    process.env.SKYVAULT_ANALYSIS_MODEL = "claude-sonnet-4-5";
    mockClaudeReturns(VALID_RESPONSE_JSON);
    await analyzeRoof(["a"], ["image/jpeg"]);
    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe("claude-sonnet-4-5");
    expect(call).not.toHaveProperty("output_config");
  });

  it("parses the answer's text and ignores the model's thinking", async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "", signature: "sig" },
        { type: "text", text: JSON.stringify(VALID_RESPONSE_JSON) },
      ],
    });
    const result = await analyzeRoof(["a"], ["image/jpeg"]);
    expect(result.condition_score).toBe(VALID_RESPONSE_JSON.condition_score);
  });

  it("fails naming the reason when the model declines", async () => {
    mockCreate.mockResolvedValueOnce({ stop_reason: "refusal", content: [] });
    await expect(analyzeRoof(["a"], ["image/jpeg"])).rejects.toThrow(/refusal/);
  });

  it("fails naming the reason when the answer is cut short", async () => {
    mockCreate.mockResolvedValueOnce({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"condition_score": 7' }] });
    await expect(analyzeRoof(["a"], ["image/jpeg"])).rejects.toThrow(/max_tokens/);
  });
});
