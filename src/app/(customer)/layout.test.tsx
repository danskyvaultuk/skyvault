import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "u1", email: "jane@example.com", role: "customer" } }) }));
vi.mock("@/lib/journeys", () => ({ journeys: { droneEnabled: false, rooferEnabled: false } }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

const { default: CustomerLayout } = await import("./layout");

const html = renderToStaticMarkup((await CustomerLayout({ children: <p>page</p> })) as ReactElement);
const menu = html.slice(html.indexOf('data-testid="mobile-menu"'));
const desktopHeader = html.slice(html.lastIndexOf("<header", html.indexOf('data-testid="desktop-header"')));

describe("customer layout on phones (BL-078 / SPEC-027 C1, C2, F1)", () => {
  it("C1/F1: the phone menu holds the signed-in email and a one-click Sign out button", () => {
    expect(menu).toContain("jane@example.com");
    expect(menu).toMatch(/<button[^>]*>Sign out<\/button>/);
  });

  it("C1: the desktop top bar is hidden at phone widths, so phones have one header", () => {
    expect(desktopHeader).toMatch(/^<header class="hidden md:flex/);
  });

  it("C2: the page scrolls as a whole, with no inner scroll box around the content", () => {
    const source = readFileSync("src/app/(customer)/layout.tsx", "utf8");
    expect(source).not.toContain("overflow-hidden");
    expect(source).not.toContain("overflow-auto");
    expect(html).toContain('<main class="flex-1 bg-gray-50"><p>page</p></main>');
  });
});
