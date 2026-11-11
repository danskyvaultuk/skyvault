import { describe, expect, it } from "vitest";
import { reviewStatus } from "./reviewStatus";

describe("reviewStatus", () => {
  it("words a held report as waiting for review", () => {
    expect(reviewStatus("draft")).toEqual({ label: "Waiting for review", waiting: true });
  });

  it("words a report approved as written", () => {
    expect(reviewStatus("published")).toEqual({ label: "Approved", waiting: false });
  });

  it("words a report approved after the admin changed it", () => {
    expect(reviewStatus("overridden")).toEqual({ label: "Approved with changes", waiting: false });
  });

  it("treats only draft as waiting", () => {
    const waiting = (["draft", "published", "overridden"] as const).filter((s) => reviewStatus(s).waiting);
    expect(waiting).toEqual(["draft"]);
  });
});
