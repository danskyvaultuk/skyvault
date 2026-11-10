// Decides which pages and APIs the launch-scope switches (BL-058) leave
// reachable. Used by middleware.ts; kept free of Next.js and auth so it can
// be tested on its own.
import type { JourneySwitches } from "@/lib/journeys";

type Switches = Pick<JourneySwitches, "droneEnabled" | "rooferEnabled">;

export type PageDecision = { kind: "allow" } | { kind: "redirect"; to: string };
export type ApiDecision = "allow" | "not-found";

export const UNAVAILABLE_PATH = "/unavailable";

const DRONE_APIS = ["/api/drone-jobs", "/api/stripe/drone-checkout"];
const ROOFER_APIS = ["/api/leads", "/api/roofer", "/api/stripe/checkout", "/api/stripe/portal"];
const DRONE_PAGES = ["/drone"];
// The Quotes page lists roofer claims, so it belongs to the roofer journey
// until BL-060 replaces it.
const ROOFER_PAGES = ["/roofer", "/quotes"];

function isUnder(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export class JourneyGuard {
  constructor(private readonly switches: Switches) {}

  apiDecision(pathname: string): ApiDecision {
    return isUnder(pathname, this.disabledApis()) ? "not-found" : "allow";
  }

  pageDecision(pathname: string, role: string): PageDecision {
    if (this.isDisabledRole(role)) {
      return pathname === UNAVAILABLE_PATH ? { kind: "allow" } : { kind: "redirect", to: UNAVAILABLE_PATH };
    }
    if (isUnder(pathname, this.disabledPages())) {
      return { kind: "redirect", to: this.homeFor(role) };
    }
    return { kind: "allow" };
  }

  homeFor(role: string): string {
    if (this.isDisabledRole(role)) return UNAVAILABLE_PATH;
    switch (role) {
      case "roofer": return "/roofer/dashboard";
      case "drone":  return "/drone/dashboard";
      case "admin":  return "/admin/dashboard";
      default:       return "/dashboard";
    }
  }

  private isDisabledRole(role: string): boolean {
    return (role === "roofer" && !this.switches.rooferEnabled) || (role === "drone" && !this.switches.droneEnabled);
  }

  private disabledApis(): string[] {
    return [
      ...(this.switches.droneEnabled ? [] : DRONE_APIS),
      ...(this.switches.rooferEnabled ? [] : ROOFER_APIS),
    ];
  }

  private disabledPages(): string[] {
    return [
      ...(this.switches.droneEnabled ? [] : DRONE_PAGES),
      ...(this.switches.rooferEnabled ? [] : ROOFER_PAGES),
    ];
  }
}
