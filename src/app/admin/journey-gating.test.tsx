import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const switches = { droneEnabled: false, rooferEnabled: false };
vi.mock("@/lib/journeys", () => ({ journeys: switches }));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "a1", email: "admin@skyvaultuk.com", role: "admin" } }) }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));
const mockSurveyFindMany = vi.fn();
const mockUserFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    survey: { findMany: (...a: unknown[]) => mockSurveyFindMany(...a) },
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
  },
}));

const { default: AdminLayout } = await import("./layout");
const { default: AdminRoofersPage } = await import("./roofers/page");
const { default: AdminSurveysPage } = await import("./surveys/page");
const { default: AdminUsersPage } = await import("./users/page");

const render = async (page: Promise<unknown>) => renderToStaticMarkup((await page) as ReactElement);

const SURVEY = {
  id: "s1", type: "self_upload", status: "complete", createdAt: new Date("2026-11-16"), updatedAt: new Date("2026-11-16"),
  property: { address: "12 High Street", postcode: "TQ9 5QH" },
  customer: { name: "Jane", email: "jane@example.com" },
  report: null, _count: { images: 3 },
};

beforeEach(() => {
  switches.droneEnabled = false;
  switches.rooferEnabled = false;
  mockSurveyFindMany.mockReset().mockResolvedValue([SURVEY]);
  mockUserFindMany.mockReset().mockResolvedValue([]);
});

describe("admin roofer and drone parts follow the journey switches (BL-080 / SPEC-029 D1–D3)", () => {
  it("D1: the menu has no Verify Roofers with the roofer journey off, and has it when on", async () => {
    expect(await render(AdminLayout({ children: <p>x</p> }))).not.toContain("Verify Roofers");
    switches.rooferEnabled = true;
    expect(await render(AdminLayout({ children: <p>x</p> }))).toContain("Verify Roofers");
  });

  it("D1: the roofers page is not found with the roofer journey off, and shows when on", async () => {
    await expect(AdminRoofersPage()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    switches.rooferEnabled = true;
    expect(await render(AdminRoofersPage())).toContain("Roofer Verification");
  });

  it("D2/D3: the surveys list has a Type column only with the drone journey on", async () => {
    const off = await render(AdminSurveysPage());
    expect(off).not.toMatch(/<th[^>]*>Type<\/th>/);
    expect(off).not.toMatch(/self upload/i);
    switches.droneEnabled = true;
    const on = await render(AdminSurveysPage());
    expect(on).toMatch(/<th[^>]*>Type<\/th>/);
    expect(on).toMatch(/self upload/i);
  });
});

describe("the role changer follows the journey switches (BL-080 / SPEC-029 D1, D3)", () => {
  const USER = { id: "u1", name: "Jane", email: "jane@example.com", role: "customer", createdAt: new Date("2026-11-15"), _count: { properties: 1, surveys: 1 } };
  const options = (html: string) => [...html.matchAll(/<option value="([a-z]+)"/g)].map((m) => m[1]);

  it("offers customer and admin only with both journeys off, and roofer and drone when on", async () => {
    mockUserFindMany.mockResolvedValue([USER]);
    expect(options(await render(AdminUsersPage()))).toEqual(["customer", "admin"]);
    switches.rooferEnabled = true;
    switches.droneEnabled = true;
    expect(options(await render(AdminUsersPage()))).toEqual(["customer", "roofer", "drone", "admin"]);
  });

  it("still shows a user's current roofer role with the roofer journey off", async () => {
    mockUserFindMany.mockResolvedValue([{ ...USER, role: "roofer" }]);
    expect(options(await render(AdminUsersPage()))).toEqual(["customer", "roofer", "admin"]);
  });
});
