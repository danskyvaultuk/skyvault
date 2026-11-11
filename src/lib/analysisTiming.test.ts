import { describe, expect, it } from "vitest";
import { analysisTiming } from "./analysisTiming";

describe("analysisTiming", () => {
  it("reads the model and the whole run's time in seconds", () => {
    expect(analysisTiming({ condition_score: 7, analysis_meta: { model: "claude-opus-5-5", ai_ms: 41200, total_ms: 45600 } })).toEqual({
      model: "claude-opus-5-5",
      aiSeconds: 41,
      totalSeconds: 46,
      slow: false,
    });
  });

  it("marks a run over the 60-second target as slow", () => {
    expect(analysisTiming({ analysis_meta: { model: "m", ai_ms: 58000, total_ms: 60001 } })?.slow).toBe(true);
    expect(analysisTiming({ analysis_meta: { model: "m", ai_ms: 58000, total_ms: 60000 } })?.slow).toBe(false);
  });

  it("answers null for a report made before timing was recorded, or a malformed one", () => {
    expect(analysisTiming({ condition_score: 7 })).toBeNull();
    expect(analysisTiming(null)).toBeNull();
    expect(analysisTiming({ analysis_meta: { model: "m", ai_ms: "fast" } })).toBeNull();
  });
});
