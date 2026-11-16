import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { DashboardData } from "@/lib/adminDashboard";

const switches = { droneEnabled: false, rooferEnabled: false };
vi.mock("@/lib/journeys", () => ({ journeys: switches }));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "a1", role: "admin" } }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "skyvault.example" }) }));
// The roofer marketplace loads its own data; here it only has to appear or not.
vi.mock("./roofer-marketplace", () => ({ RooferMarketplace: () => <section>Roofer marketplace and Recent claims</section> }));

const DATA: DashboardData = {
  reportsToReview: 2, openRooferRequests: 1, failedAnalyses: 0, urgentReports: 1, waitingToAnalyse: 3,
  newCustomersThisWeek: 4, newSurveysThisWeek: 5, totalCustomers: 9,
  surveysByStatus: { draft: 2, pending: 0, analysing: 0, complete: 6, failed: 1 }, draftsWithNoPhotos: 1,
  reportsReleased: 6, averageScore: 6.25, reportsCorrected: 1, refusalsThisWeek: [], customersAtLimit: 0, rooferRequestsHandled: 2,
  recentSurveys: [{
    id: "s1", status: "complete", createdAt: new Date("2026-11-15"),
    property: { address: "12 High Street", postcode: "TQ9 5QH" }, customer: { name: "Jane", email: "jane@example.com" }, report: { id: "r1" },
  }, {
    id: "s2", status: "draft", createdAt: new Date("2026-11-16"),
    property: { address: "3 Mill Lane", postcode: "TQ9 5AA" }, customer: { name: null, email: "sam@example.com" }, report: null,
  }],
  newCustomers: [{ id: "u1", name: "Jane", email: "jane@example.com", createdAt: new Date("2026-11-15") }],
};
vi.mock("@/lib/adminDashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/adminDashboard")>()),
  loadAdminDashboard: async () => DATA,
}));

const { default: AdminDashboard } = await import("./page");
const render = async () => renderToStaticMarkup((await AdminDashboard()) as ReactElement);

beforeEach(() => {
  switches.rooferEnabled = false;
});

describe("admin dashboard page (BL-080 / SPEC-029)", () => {
  it("A1/A2: shows the site addresses first, then the five card groups in order", async () => {
    const html = await render();
    const order = ["Site addresses", "Needs action", "Customers and surveys", "Reports", "Problems", "Roofer introductions"].map((h) => html.indexOf(`>${h}</h2>`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("Reports to review");
    expect(html).toContain('href="/admin/roofer-requests"');
  });

  it("B1: lists recent surveys of any status with a Review link where there is a report, and new customers", async () => {
    const html = await render();
    expect(html).toContain("Recent surveys");
    expect(html).toContain("12 High Street");
    expect(html).toContain("3 Mill Lane");
    expect(html).toContain('href="/admin/reports/r1"');
    expect(html).toContain("New customers");
    expect(html).toContain("joined");
  });

  it("B2/A3: shows the roofer marketplace and its claims only with the roofer journey on", async () => {
    expect(await render()).not.toContain("Recent claims");
    switches.rooferEnabled = true;
    expect(await render()).toContain("Recent claims");
  });

  it("E1: has no Sentry test button", async () => {
    expect(await render()).not.toMatch(/sentry/i);
    expect(readFileSync("src/app/admin/dashboard/page.tsx", "utf8")).not.toContain("SentryTestButton");
  });
});
