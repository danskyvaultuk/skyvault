import { describe, expect, it, vi, beforeEach } from "vitest";

const calls = {
  reportCount: vi.fn(), leadCount: vi.fn(), surveyCount: vi.fn(), userCount: vi.fn(), reportAggregate: vi.fn(),
  surveyGroupBy: vi.fn(), refusalGroupBy: vi.fn(), surveyFindMany: vi.fn(), userFindMany: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    report: { count: (a: unknown) => calls.reportCount(a), aggregate: (a: unknown) => calls.reportAggregate(a) },
    lead: { count: (a: unknown) => calls.leadCount(a) },
    survey: { count: (a: unknown) => calls.surveyCount(a), groupBy: (a: unknown) => calls.surveyGroupBy(a), findMany: (a: unknown) => calls.surveyFindMany(a) },
    user: { count: (a: unknown) => calls.userCount(a), findMany: (a: unknown) => calls.userFindMany(a) },
    photoRefusal: { groupBy: (a: unknown) => calls.refusalGroupBy(a) },
  },
}));

const { loadAdminDashboard, dashboardCards } = await import("./adminDashboard");

const NOW = new Date("2026-11-16T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const DAY = 24 * 60 * 60 * 1000;
type Args = { where?: Record<string, unknown>; by?: string[] };
const wheres = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map(([a]) => (a as Args).where);

beforeEach(() => {
  Object.values(calls).forEach((fn) => fn.mockReset());
  calls.reportCount.mockResolvedValue(2);
  calls.leadCount.mockResolvedValue(1);
  calls.surveyCount.mockResolvedValue(3);
  calls.userCount.mockResolvedValue(4);
  calls.reportAggregate.mockResolvedValue({ _avg: { conditionScore: 6.44 } });
  calls.surveyGroupBy.mockImplementation(async (a: Args) => {
    if (a.by?.[0] === "status") return [{ status: "draft", _count: { _all: 5 } }, { status: "complete", _count: { _all: 7 } }];
    // Two customers: one at 5 (the limit), one at 4.
    return [{ customerId: "c-at-limit", _count: { _all: 5 } }, { customerId: "c-under", _count: { _all: 4 } }];
  });
  calls.refusalGroupBy.mockResolvedValue([{ reason: "too-blurry", _count: { _all: 3 } }, { reason: "too-small", _count: { _all: 1 } }]);
  calls.surveyFindMany.mockResolvedValue([]);
  calls.userFindMany.mockResolvedValue([]);
});

describe("loadAdminDashboard — each count by its definition (BL-080 / SPEC-029 A1)", () => {
  it("reports: held for review, urgent, released, corrected and the released average", async () => {
    const d = await loadAdminDashboard(NOW);
    expect(wheres(calls.reportCount)).toEqual([
      { status: "draft" },
      { rawAiResponse: { path: ["urgent_action_required"], equals: true } },
      { status: { in: ["published", "overridden"] } },
      { status: "overridden" },
    ]);
    expect(calls.reportAggregate).toHaveBeenCalledWith({ _avg: { conditionScore: true }, where: { status: { in: ["published", "overridden"] } } });
    expect(d.averageScore).toBe(6.44);
  });

  it("roofer requests: open and handled", async () => {
    await loadAdminDashboard(NOW);
    expect(wheres(calls.leadCount)).toEqual([{ status: "open" }, { status: "closed" }]);
  });

  it("surveys: failed or stuck over 10 minutes, waiting to be analysed, this week, drafts with no photos", async () => {
    await loadAdminDashboard(NOW);
    expect(wheres(calls.surveyCount)).toEqual([
      { OR: [{ status: "failed" }, { status: "analysing", updatedAt: { lt: ago(10 * 60 * 1000) } }] },
      { status: "draft", images: { some: {} } },
      { createdAt: { gte: ago(7 * DAY) } },
      { status: "draft", images: { none: {} } },
    ]);
  });

  it("customers: new this week and in total", async () => {
    await loadAdminDashboard(NOW);
    expect(wheres(calls.userCount)).toEqual([{ role: "customer", createdAt: { gte: ago(7 * DAY) } }, { role: "customer" }]);
  });

  it("surveys by status, with every status present", async () => {
    const d = await loadAdminDashboard(NOW);
    expect(d.surveysByStatus).toEqual({ draft: 5, pending: 0, analysing: 0, complete: 7, failed: 0 });
  });

  it("photo refusals in the last 7 days, by reason", async () => {
    const d = await loadAdminDashboard(NOW);
    expect(calls.refusalGroupBy).toHaveBeenCalledWith({ by: ["reason"], where: { createdAt: { gte: ago(7 * DAY) } }, _count: { _all: true } });
    expect(d.refusalsThisWeek).toEqual([{ reason: "too-blurry", count: 3 }, { reason: "too-small", count: 1 }]);
  });

  it("customers at the daily limit, by each limit's own rule, counted once", async () => {
    const d = await loadAdminDashboard(NOW);
    const limitQueries = calls.surveyGroupBy.mock.calls.map(([a]) => a as Args).filter((a) => a.by?.[0] === "customerId");
    expect(limitQueries.map((a) => a.where)).toEqual([
      { status: { in: ["analysing", "complete", "failed"] }, updatedAt: { gte: ago(DAY) } },
      { createdAt: { gte: ago(DAY) } },
    ]);
    expect(d.customersAtLimit).toBe(1);
  });
});

describe("loadAdminDashboard — the lists (BL-080 / SPEC-029 B1)", () => {
  it("the last five surveys of any status, newest first, with their report id", async () => {
    await loadAdminDashboard(NOW);
    const [args] = calls.surveyFindMany.mock.calls[0] as [Record<string, unknown>];
    expect(args.where).toBeUndefined();
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.take).toBe(5);
    expect(args.include).toMatchObject({ report: { select: { id: true } } });
  });

  it("the last five customers to join, newest first", async () => {
    await loadAdminDashboard(NOW);
    expect(calls.userFindMany).toHaveBeenCalledWith({
      where: { role: "customer" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, email: true, createdAt: true },
    });
  });
});

describe("dashboardCards (BL-080 / SPEC-029 A1)", () => {
  it("gives the fifteen cards in five groups, in order, each with its link", async () => {
    const groups = dashboardCards(await loadAdminDashboard(NOW));
    expect(groups.map((g) => [g.heading, g.cards.map((c) => [c.label, c.href])])).toEqual([
      ["Needs action", [
        ["Reports to review", "/admin/reports"],
        ["Open roofer requests", "/admin/roofer-requests"],
        ["Failed analyses", "/admin/surveys"],
        ["Urgent reports", "/admin/reports"],
        ["Surveys waiting to be analysed", "/admin/surveys"],
      ]],
      ["Customers and surveys", [
        ["Activity this week", "/admin/users"],
        ["Total customers", "/admin/users"],
        ["Total surveys", "/admin/surveys"],
        ["Drafts with no photos", "/admin/surveys"],
      ]],
      ["Reports", [
        ["Reports released", "/admin/reports"],
        ["Average condition score", "/admin/reports"],
        ["Reports corrected", "/admin/reports"],
      ]],
      ["Problems", [
        ["Photos rejected", "/admin/surveys"],
        ["Customers at the daily limit", "/admin/users"],
      ]],
      ["Roofer introductions", [["Roofer requests handled", "/admin/roofer-requests"]]],
    ]);
  });

  it("shows the values: activity as two figures, survey totals by status, refusals by reason, the average to one place", async () => {
    const cards = dashboardCards(await loadAdminDashboard(NOW)).flatMap((g) => g.cards);
    const card = (label: string) => cards.find((c) => c.label === label)!;
    expect(card("Activity this week").value).toBe("4 / 3");
    expect(card("Total surveys")).toMatchObject({ value: "12", detail: "5 draft · 7 complete" });
    expect(card("Photos rejected")).toMatchObject({ value: "4", detail: "last 7 days: 3 blurry · 1 too small" });
    expect(card("Average condition score").value).toBe("6.4");
  });

  it("shows — for the average when no report is released", async () => {
    calls.reportAggregate.mockResolvedValue({ _avg: { conditionScore: null } });
    const cards = dashboardCards(await loadAdminDashboard(NOW)).flatMap((g) => g.cards);
    expect(cards.find((c) => c.label === "Average condition score")!.value).toBe("—");
  });

  it("does not include the old cards", async () => {
    const labels = dashboardCards(await loadAdminDashboard(NOW)).flatMap((g) => g.cards.map((c) => c.label));
    for (const old of ["Total users", "Roofers", "Active subscriptions", "Open leads", "Total claims"]) expect(labels).not.toContain(old);
  });
});
