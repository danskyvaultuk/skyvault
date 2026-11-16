import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "u1", email: "jane@example.com", role: "customer" } }) }));
vi.mock("@/lib/journeys", () => ({ journeys: { droneEnabled: false, rooferEnabled: false } }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));
const stored = { name: "Jane" as string | null };
const mockFindUnique = vi.fn(async () => ({ name: stored.name }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => mockFindUnique(...(a as [])) } } }));

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

describe("the name step (BL-081 / SPEC-030 B1, B3)", () => {
  const renderWith = async (name: string | null) => {
    stored.name = name;
    return renderToStaticMarkup((await CustomerLayout({ children: <p>the page</p> })) as ReactElement);
  };

  it("B1: a customer with no name sees the name step in place of the page", async () => {
    for (const name of [null, "", "   "]) {
      const page = await renderWith(name);
      expect(page).toContain("What should we call you?");
      expect(page).not.toContain("the page");
    }
  });

  it("B3: a customer with a name sees the page, never the step", async () => {
    const page = await renderWith("Jane");
    expect(page).toContain("the page");
    expect(page).not.toContain("What should we call you?");
  });

  it("looks up the signed-in user's own stored name", async () => {
    await renderWith("Jane");
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "u1" }, select: { name: true } });
  });
});
