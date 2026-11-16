import { describe, expect, it } from "vitest";
import { reviewFailureMessage } from "./reviewFailureMessage";

describe("reviewFailureMessage (BL-083 / SPEC-031 C1)", () => {
  it.each([
    [400, /check the values/],
    [403, /not allowed/],
    [404, /could not be found/],
    [409, /already released, or still held/],
    [500, /server hit an error \(500\)/],
    [503, /server hit an error \(503\)/],
    [null, /No answer from the server/],
  ])("says what kind of failure %s was", (status, message) => {
    expect(reviewFailureMessage(status)).toMatch(message);
  });

  it("never says only That didn't work", () => {
    for (const status of [400, 403, 404, 409, 418, 500, null]) {
      expect(reviewFailureMessage(status)).not.toMatch(/That didn.t work/);
    }
  });
});
