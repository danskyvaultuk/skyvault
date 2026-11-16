import { describe, expect, it } from "vitest";
import { openSignUpRole } from "./signUpRole";

const OFF = { rooferEnabled: false, droneEnabled: false };
const ON = { rooferEnabled: true, droneEnabled: true };

describe("openSignUpRole (BL-081 / SPEC-030 A3)", () => {
  it("never opens sign-up for customers, or for no role", () => {
    for (const role of [undefined, null, "", "customer", "admin"]) {
      expect(openSignUpRole(role, ON)).toBeNull();
    }
  });

  it("opens roofer and drone sign-up only while their journey is on", () => {
    expect(openSignUpRole("roofer", OFF)).toBeNull();
    expect(openSignUpRole("drone", OFF)).toBeNull();
    expect(openSignUpRole("roofer", ON)).toBe("roofer");
    expect(openSignUpRole("drone", ON)).toBe("drone");
    expect(openSignUpRole("drone", { rooferEnabled: true, droneEnabled: false })).toBeNull();
  });
});
