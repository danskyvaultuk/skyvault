import { describe, expect, it } from "vitest";
import { offeredRoles } from "./adminRoles";

const OFF = { rooferEnabled: false, droneEnabled: false };

describe("offeredRoles (BL-080 / SPEC-029 D1, D3)", () => {
  it("offers only customer and admin while both journeys are off", () => {
    expect(offeredRoles(OFF, "customer")).toEqual(["customer", "admin"]);
  });

  it("still shows a user's current roofer or drone role", () => {
    expect(offeredRoles(OFF, "roofer")).toEqual(["customer", "roofer", "admin"]);
    expect(offeredRoles(OFF, "drone")).toEqual(["customer", "drone", "admin"]);
  });

  it("offers roofer or drone again when its journey is on", () => {
    expect(offeredRoles({ rooferEnabled: true, droneEnabled: false }, "customer")).toEqual(["customer", "roofer", "admin"]);
    expect(offeredRoles({ rooferEnabled: false, droneEnabled: true }, "customer")).toEqual(["customer", "drone", "admin"]);
    expect(offeredRoles({ rooferEnabled: true, droneEnabled: true }, "customer")).toEqual(["customer", "roofer", "drone", "admin"]);
  });
});
