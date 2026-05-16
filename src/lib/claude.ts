import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Zod schema — defines exactly what shape we expect back from Claude ────────
// Zod validates the JSON at runtime, so if Claude hallucinates a field we catch it
const DefectSchema = z.object({
  type: z.enum([
    "missing_tiles", "cracked_tiles", "moss_growth", "flashing_damage",
    "gutter_damage", "ridge_damage", "valley_damage", "other",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().max(150),
  image_index: z.number().int().min(0),
});

export const RoofAnalysisSchema = z.object({
  condition_score: z.number().int().min(1).max(10),
  defects: z.array(DefectSchema),
  estimated_remaining_life_years: z.number().int().nullable(),
  recommendations: z.array(z.string()),
  urgent_action_required: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]),
  surveyor_notes: z.string(),
});

export type RoofAnalysis = z.infer<typeof RoofAnalysisSchema>;

// ── The prompt ─────────────────────────────────────────────────────────────────
// We ask Claude to return ONLY valid JSON — no markdown fences, no prose.
// This makes parsing reliable.
const SYSTEM_PROMPT = `You are a professional roofing surveyor AI with 20 years of experience.
Analyse the provided roof images thoroughly.

Return ONLY valid JSON matching this exact schema — no markdown, no prose, no explanation:
{
  "condition_score": <integer 1–10, where 10 = perfect new roof>,
  "defects": [{
    "type": "<missing_tiles|cracked_tiles|moss_growth|flashing_damage|gutter_damage|ridge_damage|valley_damage|other>",
    "severity": "<low|medium|high|critical>",
    "description": "<max 150 chars describing location and extent>",
    "image_index": <0-based index of the image showing this defect>
  }],
  "estimated_remaining_life_years": <integer or null if unable to estimate>,
  "recommendations": ["<specific action item>"],
  "urgent_action_required": <true if score <= 3 or any critical defect>,
  "confidence": "<low|medium|high — based on image quality and coverage>",
  "surveyor_notes": "<overall summary, max 1000 chars>"
}

Scoring guide:
  1–3 = Replace soon (structural risk)
  4–6 = Repair needed (significant defects)
  7–9 = Maintenance recommended (minor issues)
  10  = Excellent condition

List defects from most to least severe.
If image quality prevents proper assessment, set confidence to "low" and note why.`;

// ── Main export ────────────────────────────────────────────────────────────────
// base64Images: array of base64-encoded image strings (no data: prefix needed)
// mimeTypes: matching array of MIME types e.g. "image/jpeg"
export async function analyzeRoof(
  base64Images: string[],
  mimeTypes: string[]
): Promise<RoofAnalysis> {
  // Build the content array — one image block per photo
  // Claude Vision accepts up to 20 images per request
  const imageBlocks: Anthropic.ImageBlockParam[] = base64Images.map((data, i) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: mimeTypes[i] as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      data,
    },
  }));

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: `Please analyse these ${base64Images.length} roof image(s) and return the JSON assessment.`,
          },
        ],
      },
    ],
  });

  // Extract the text content from Claude's response
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as Anthropic.TextBlock).text)
    .join("");

  // Strip markdown code fences if Claude ignored the "no markdown" instruction
  // e.g. ```json { ... } ``` → { ... }
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  // Parse and validate with Zod — throws if Claude returns unexpected shape
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned non-JSON response: ${cleaned.slice(0, 200)}`);
  }

  const result = RoofAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Claude response failed validation: ${JSON.stringify(result.error.flatten())}`);
  }

  return result.data;
}
