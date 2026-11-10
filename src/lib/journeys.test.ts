import { describe, it, expect } from "vitest";
import { JourneySwitches } from "./journeys";

describe("JourneySwitches", () => {
  it("turns both journeys off when neither setting is present", () => {
    const switches = new JourneySwitches({ drone: undefined, roofer: undefined });
    expect(switches.droneEnabled).toBe(false);
    expect(switches.rooferEnabled).toBe(false);
  });

  it("turns the drone journey on only from its own setting", () => {
    const switches = new JourneySwitches({ drone: "on", roofer: undefined });
    expect(switches.droneEnabled).toBe(true);
    expect(switches.rooferEnabled).toBe(false);
  });

  it("turns the roofer journey on only from its own setting", () => {
    const switches = new JourneySwitches({ drone: undefined, roofer: "on" });
    expect(switches.droneEnabled).toBe(false);
    expect(switches.rooferEnabled).toBe(true);
  });

  it("leaves a journey off for any value other than 'on'", () => {
    for (const value of ["", "off", "true", "ON", "1", "yes"]) {
      const switches = new JourneySwitches({ drone: value, roofer: value });
      expect(switches.droneEnabled).toBe(false);
      expect(switches.rooferEnabled).toBe(false);
    }
  });
});
