import { describe, it, expect } from "vitest";
import { JourneyGuard } from "./journeyGuard";

const OFF = new JourneyGuard({ droneEnabled: false, rooferEnabled: false });
const ON = new JourneyGuard({ droneEnabled: true, rooferEnabled: true });

const DRONE_APIS = ["/api/drone-jobs", "/api/drone-jobs/job-1", "/api/stripe/drone-checkout"];
const ROOFER_APIS = [
  "/api/leads",
  "/api/leads/lead-1/claim",
  "/api/roofer/profile",
  "/api/stripe/checkout",
  "/api/stripe/portal",
];
const DISABLED_PAGES = ["/drone/dashboard", "/drone/jobs/1", "/roofer/dashboard", "/roofer/leads", "/quotes"];

describe("JourneyGuard with both journeys off", () => {
  it.each([...DRONE_APIS, ...ROOFER_APIS])("refuses the API %s", (path) => {
    expect(OFF.apiDecision(path)).toBe("not-found");
  });

  it.each(["/api/stripe/webhook", "/api/surveys", "/api/auth/register", "/api/properties"])(
    "allows the API %s",
    (path) => {
      expect(OFF.apiDecision(path)).toBe("allow");
    }
  );

  it.each(DISABLED_PAGES)("redirects a customer away from %s", (path) => {
    expect(OFF.pageDecision(path, "customer")).toEqual({ kind: "redirect", to: "/dashboard" });
  });

  it.each(DISABLED_PAGES)("redirects an admin away from %s", (path) => {
    expect(OFF.pageDecision(path, "admin")).toEqual({ kind: "redirect", to: "/admin/dashboard" });
  });

  it.each(["roofer", "drone"])("sends a %s account to the not-available page", (role) => {
    for (const path of ["/dashboard", `/${role}/dashboard`, "/surveys"]) {
      expect(OFF.pageDecision(path, role)).toEqual({ kind: "redirect", to: "/unavailable" });
    }
  });

  it.each(["roofer", "drone"])("lets a %s account see the not-available page (no loop)", (role) => {
    expect(OFF.pageDecision("/unavailable", role)).toEqual({ kind: "allow" });
  });

  it("allows a customer's own pages", () => {
    for (const path of ["/dashboard", "/surveys/new", "/properties"]) {
      expect(OFF.pageDecision(path, "customer")).toEqual({ kind: "allow" });
    }
  });

  it("gives each role's landing page", () => {
    expect(OFF.homeFor("customer")).toBe("/dashboard");
    expect(OFF.homeFor("admin")).toBe("/admin/dashboard");
    expect(OFF.homeFor("roofer")).toBe("/unavailable");
    expect(OFF.homeFor("drone")).toBe("/unavailable");
  });
});

describe("JourneyGuard with both journeys on", () => {
  it.each([...DRONE_APIS, ...ROOFER_APIS])("allows the API %s", (path) => {
    expect(ON.apiDecision(path)).toBe("allow");
  });

  it.each(DISABLED_PAGES)("allows the page %s", (path) => {
    expect(ON.pageDecision(path, "admin")).toEqual({ kind: "allow" });
  });

  it("gives roofer and drone accounts their portals", () => {
    expect(ON.homeFor("roofer")).toBe("/roofer/dashboard");
    expect(ON.homeFor("drone")).toBe("/drone/dashboard");
    expect(ON.pageDecision("/roofer/dashboard", "roofer")).toEqual({ kind: "allow" });
  });
});
