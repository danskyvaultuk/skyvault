// Which Claude model analyses the roof photos, and how the request is shaped
// for it (BL-067 / SPEC-015). The model is a setting, so switching back is a
// Vercel settings change rather than a code change.

export const DEFAULT_ANALYSIS_MODEL = "claude-opus-5-5";

type ModelEnv = { SKYVAULT_ANALYSIS_MODEL?: string };

export function analysisModel(env: ModelEnv): string {
  return env.SKYVAULT_ANALYSIS_MODEL?.trim() || DEFAULT_ANALYSIS_MODEL;
}

// Older models refuse an effort level outright; every current one accepts it.
const NO_EFFORT_PREFIXES = ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1", "claude-opus-4-0", "claude-sonnet-4-0"];

export type AnalysisRequestOptions = {
  max_tokens: number;
  output_config?: { effort: "high" };
};

/**
 * Room for the model's thinking as well as the JSON answer, kept within what
 * the SDK allows without streaming. No sampling setting is sent: current
 * models refuse one.
 */
export function analysisRequestOptions(model: string): AnalysisRequestOptions {
  const max_tokens = 16000;
  if (NO_EFFORT_PREFIXES.some((prefix) => model.startsWith(prefix))) return { max_tokens };
  return { max_tokens, output_config: { effort: "high" } };
}
