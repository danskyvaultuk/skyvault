import { describe, expect, it } from "vitest";
import { SITE_DESCRIPTION, SITE_TITLE, homeContent } from "./homeContent";

const OFF = { droneEnabled: false, rooferEnabled: false };

function allText(content: ReturnType<typeof homeContent>): string {
  return JSON.stringify({
    hero: content.hero,
    steps: content.steps,
    pricing: content.pricing,
    site: [SITE_TITLE, SITE_DESCRIPTION],
  });
}

describe("homeContent — launch copy, both journeys off (SPEC-018 A2)", () => {
  const text = allText(homeContent(OFF));

  it.each([
    ["the customer photographs their own roof with a guided checklist", /your own photos|photograph your roof/i, /checklist/i],
    ["the AI analyses and the team checks every report before release", /AI/, /checks every report/i],
    ["the customer is emailed with the PDF", /email/i, /PDF/],
    ["they can ask to be put in touch with a local roofer", /put you in touch with a local roofer/i, /roofer/i],
    ["it is free", /free/i, /free/i],
  ])("says %s", (_label, first, second) => {
    expect(text).toMatch(first);
    expect(text).toMatch(second);
  });
});

describe("homeContent — forbidden claims, both journeys off (SPEC-018 A3)", () => {
  const text = allText(homeContent(OFF));

  it.each([
    ["a drone survey or capture", /drone/i],
    ["a price other than free", /£\s?\d/],
    ["roofer quotes", /quote/i],
    ["sharing with a number of roofers", /up to \d|\b\d+ roofers/i],
    ["verified roofers", /verified/i],
    ["a turnaround", /in minutes|within minutes|48 hours|within \d+ (hours|days)/i],
    ["a named service area", /London|Manchester|Birmingham/i],
  ])("makes no claim of %s", (_label, pattern) => {
    expect(text).not.toMatch(pattern);
  });
});

describe("homeContent — switched sections (SPEC-018 B)", () => {
  it("shows no drone or roofer section, card or footer link with both journeys off", () => {
    const content = homeContent(OFF);
    expect(content.showDroneOperatorSection).toBe(false);
    expect(content.showRooferSection).toBe(false);
    expect(content.pricing.plans.map((p) => p.name)).toEqual(["Self upload"]);
    expect(content.footerLinks.map((l) => l.href)).toEqual(["/login"]);
  });

  it("brings back the drone card, operator section and its footer link when the drone journey is on", () => {
    const content = homeContent({ droneEnabled: true, rooferEnabled: false });
    expect(content.showDroneOperatorSection).toBe(true);
    expect(content.showRooferSection).toBe(false);
    expect(content.pricing.plans.map((p) => p.name)).toEqual(["Self upload", "Drone Capture"]);
    expect(content.footerLinks.map((l) => l.href)).toEqual(["#operators", "/login"]);
  });

  it("brings back the roofer section and its footer link when the roofer journey is on", () => {
    const content = homeContent({ droneEnabled: false, rooferEnabled: true });
    expect(content.showRooferSection).toBe(true);
    expect(content.showDroneOperatorSection).toBe(false);
    expect(content.footerLinks.map((l) => l.href)).toEqual(["#roofers", "/login"]);
  });

  it("shows both journeys' sections, the drone card and both footer links when both are on", () => {
    const content = homeContent({ droneEnabled: true, rooferEnabled: true });
    expect(content.showDroneOperatorSection).toBe(true);
    expect(content.showRooferSection).toBe(true);
    expect(content.pricing.plans.map((p) => p.name)).toEqual(["Self upload", "Drone Capture"]);
    expect(content.footerLinks.map((l) => l.href)).toEqual(["#roofers", "#operators", "/login"]);
  });
});
