import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const switches = { droneEnabled: false, rooferEnabled: false };
vi.mock("@/lib/journeys", () => ({ journeys: switches }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const loginModule = await import("./page");

function render() {
  const Page = loginModule.default;
  return renderToStaticMarkup(<Page />).replace(/&#x27;/g, "'");
}

beforeEach(() => {
  switches.droneEnabled = false;
  switches.rooferEnabled = false;
});

describe("/login — one entry page (BL-081 / SPEC-030 A1, A2)", () => {
  it("A1: is titled Sign in or create an account, says no separate sign-up is needed, and offers both sign-in options", () => {
    const html = render();
    expect(html).toContain("Sign in or create an account");
    expect(html).toContain("your first sign-in creates your account");
    expect(html).toContain("Continue with Google");
    expect(html).toMatch(/type="email"/);
    expect(html).toContain('href="/terms"');
  });

  it("A2: offers no customer sign-up, and no professional sign-up while both journeys are off", () => {
    const html = render();
    expect(html).not.toContain("Sign up as a homeowner");
    expect(html).not.toContain("/register");
  });

  it("A2: offers roofer and drone sign-up only while their journeys are on", () => {
    switches.rooferEnabled = true;
    let html = render();
    expect(html).toContain('href="/register?role=roofer"');
    expect(html).not.toContain('href="/register?role=drone"');
    switches.droneEnabled = true;
    html = render();
    expect(html).toContain('href="/register?role=drone"');
  });
});
