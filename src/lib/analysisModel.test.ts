import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYSIS_MODEL, analysisModel, analysisRequestOptions } from "./analysisModel";

describe("analysisModel", () => {
  it("defaults to Claude Opus 5.5", () => {
    expect(DEFAULT_ANALYSIS_MODEL).toBe("claude-opus-5-5");
    expect(analysisModel({})).toBe("claude-opus-5-5");
    expect(analysisModel({ SKYVAULT_ANALYSIS_MODEL: "  " })).toBe("claude-opus-5-5");
  });

  it("uses the setting when it is set", () => {
    expect(analysisModel({ SKYVAULT_ANALYSIS_MODEL: "claude-sonnet-4-5" })).toBe("claude-sonnet-4-5");
  });
});

describe("analysisRequestOptions", () => {
  it("asks Opus 5.5 for high effort, with room for its thinking", () => {
    const options = analysisRequestOptions("claude-opus-5-5");
    expect(options.output_config).toEqual({ effort: "high" });
    expect(options.max_tokens).toBeGreaterThanOrEqual(16000);
  });

  it.each(["claude-sonnet-4-5", "claude-sonnet-4-5-20250929", "claude-haiku-4-5", "claude-opus-4-1"])(
    "sends no effort level to %s, which rejects it",
    (model) => {
      expect(analysisRequestOptions(model)).not.toHaveProperty("output_config");
    }
  );

  it("never sends a sampling setting", () => {
    expect(analysisRequestOptions("claude-opus-5-5")).not.toHaveProperty("temperature");
  });
});
