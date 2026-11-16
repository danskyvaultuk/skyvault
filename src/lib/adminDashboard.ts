// What the launch admin dashboard shows (BL-080 / SPEC-029 Parts A and B): the
// counts behind fifteen cards, in five groups, and two short lists. The counts
// are loaded here as plain data, and dashboardCards turns them into the cards,
// so the page only renders.
import type { SurveyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { staleAnalysisCutoff } from "@/lib/surveyState";
import { ANALYSIS_LIMIT, analysesInWindow } from "@/lib/analysisLimit";
import { SURVEY_CREATION_LIMIT, surveysCreatedInWindow } from "@/lib/surveyLimit";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RELEASED = ["published", "overridden"] as const;
const SURVEY_STATUSES: readonly SurveyStatus[] = ["draft", "pending", "analysing", "complete", "failed"];

export type RecentSurvey = {
  id: string;
  status: SurveyStatus;
  createdAt: Date;
  property: { address: string; postcode: string };
  customer: { name: string | null; email: string };
  report: { id: string } | null;
};
export type NewCustomer = { id: string; name: string | null; email: string; createdAt: Date };

export type DashboardData = {
  reportsToReview: number;
  openRooferRequests: number;
  failedAnalyses: number;
  urgentReports: number;
  waitingToAnalyse: number;
  newCustomersThisWeek: number;
  newSurveysThisWeek: number;
  totalCustomers: number;
  surveysByStatus: Record<SurveyStatus, number>;
  draftsWithNoPhotos: number;
  reportsReleased: number;
  averageScore: number | null;
  reportsCorrected: number;
  refusalsThisWeek: { reason: string; count: number }[];
  customersAtLimit: number;
  rooferRequestsHandled: number;
  recentSurveys: RecentSurvey[];
  newCustomers: NewCustomer[];
};

type Grouped<K extends string> = ({ _count: { _all: number } } & Record<K, string>)[];

/** Customers whose count in the window reached the limit, by the limit's own rule. */
function atLimit(groups: Grouped<"customerId">, limit: number): string[] {
  return groups.filter((g) => g._count._all >= limit).map((g) => g.customerId);
}

function countQueries(now: Date) {
  const weekAgo = new Date(now.getTime() - WEEK_MS);
  return Promise.all([
    prisma.report.count({ where: { status: "draft" } }),
    prisma.lead.count({ where: { status: "open" } }),
    prisma.survey.count({
      where: { OR: [{ status: "failed" }, { status: "analysing", updatedAt: { lt: staleAnalysisCutoff(now) } }] },
    }),
    prisma.report.count({ where: { rawAiResponse: { path: ["urgent_action_required"], equals: true } } }),
    prisma.survey.count({ where: { status: "draft", images: { some: {} } } }),
    prisma.user.count({ where: { role: "customer", createdAt: { gte: weekAgo } } }),
    prisma.survey.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { role: "customer" } }),
    prisma.survey.count({ where: { status: "draft", images: { none: {} } } }),
    prisma.report.count({ where: { status: { in: [...RELEASED] } } }),
    prisma.report.aggregate({ _avg: { conditionScore: true }, where: { status: { in: [...RELEASED] } } }),
    prisma.report.count({ where: { status: "overridden" } }),
    prisma.lead.count({ where: { status: "closed" } }),
  ]);
}

function groupQueries(now: Date) {
  const weekAgo = new Date(now.getTime() - WEEK_MS);
  return Promise.all([
    prisma.survey.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.photoRefusal.groupBy({ by: ["reason"], where: { createdAt: { gte: weekAgo } }, _count: { _all: true } }),
    // Each limit's own counting rule, from its module, so the card cannot drift from the limit.
    prisma.survey.groupBy({ by: ["customerId"], where: analysesInWindow(now), _count: { _all: true } }),
    prisma.survey.groupBy({ by: ["customerId"], where: surveysCreatedInWindow(now), _count: { _all: true } }),
  ]);
}

function listQueries() {
  return Promise.all([
    prisma.survey.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        property: { select: { address: true, postcode: true } },
        customer: { select: { name: true, email: true } },
        report: { select: { id: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "customer" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true },
    }),
  ]);
}

export async function loadAdminDashboard(now: Date = new Date()): Promise<DashboardData> {
  const [
    [reportsToReview, openRooferRequests, failedAnalyses, urgentReports, waitingToAnalyse, newCustomersThisWeek,
      newSurveysThisWeek, totalCustomers, draftsWithNoPhotos, reportsReleased, average, reportsCorrected,
      rooferRequestsHandled],
    [byStatus, refusals, analyses, created],
    [recentSurveys, newCustomers],
  ] = await Promise.all([countQueries(now), groupQueries(now), listQueries()]);

  const surveysByStatus = Object.fromEntries(SURVEY_STATUSES.map((s) => [s, 0])) as Record<SurveyStatus, number>;
  for (const g of byStatus) surveysByStatus[g.status] = g._count._all;

  const limited = new Set([...atLimit(analyses, ANALYSIS_LIMIT), ...atLimit(created, SURVEY_CREATION_LIMIT)]);

  return {
    reportsToReview, openRooferRequests, failedAnalyses, urgentReports, waitingToAnalyse,
    newCustomersThisWeek, newSurveysThisWeek, totalCustomers, surveysByStatus, draftsWithNoPhotos,
    reportsReleased, averageScore: average._avg.conditionScore ?? null, reportsCorrected,
    refusalsThisWeek: refusals.map((r) => ({ reason: r.reason, count: r._count._all })),
    customersAtLimit: limited.size,
    rooferRequestsHandled, recentSurveys, newCustomers,
  };
}

export type DashboardCard = { label: string; value: string; detail?: string; href: string };
export type DashboardGroup = { heading: string; cards: DashboardCard[] };

const REFUSAL_LABEL: Record<string, string> = {
  "too-blurry": "blurry",
  "too-small": "too small",
  "too-large": "too large",
  unreadable: "unreadable",
};

function surveyStatusDetail(byStatus: Record<SurveyStatus, number>): string {
  return SURVEY_STATUSES.filter((s) => byStatus[s] > 0).map((s) => `${byStatus[s]} ${s}`).join(" · ") || "none yet";
}

function refusalDetail(refusals: DashboardData["refusalsThisWeek"]): string {
  return refusals.map((r) => `${r.count} ${REFUSAL_LABEL[r.reason] ?? r.reason}`).join(" · ") || "none";
}

/** The fifteen launch cards, in their groups and order (SPEC-029 A1). */
export function dashboardCards(d: DashboardData): DashboardGroup[] {
  const refusalTotal = d.refusalsThisWeek.reduce((sum, r) => sum + r.count, 0);
  return [
    {
      heading: "Needs action",
      cards: [
        { label: "Reports to review", value: String(d.reportsToReview), href: "/admin/reports" },
        { label: "Open roofer requests", value: String(d.openRooferRequests), href: "/admin/roofer-requests" },
        { label: "Failed analyses", value: String(d.failedAnalyses), detail: "failed, or stuck over 10 minutes", href: "/admin/surveys" },
        { label: "Urgent reports", value: String(d.urgentReports), detail: "the AI flagged urgent action", href: "/admin/reports" },
        { label: "Surveys waiting to be analysed", value: String(d.waitingToAnalyse), detail: "photos added, not yet analysed", href: "/admin/surveys" },
      ],
    },
    {
      heading: "Customers and surveys",
      cards: [
        { label: "Activity this week", value: `${d.newCustomersThisWeek} / ${d.newSurveysThisWeek}`, detail: "new customers / new surveys", href: "/admin/users" },
        { label: "Total customers", value: String(d.totalCustomers), href: "/admin/users" },
        { label: "Total surveys", value: String(Object.values(d.surveysByStatus).reduce((a, b) => a + b, 0)), detail: surveyStatusDetail(d.surveysByStatus), href: "/admin/surveys" },
        { label: "Drafts with no photos", value: String(d.draftsWithNoPhotos), href: "/admin/surveys" },
      ],
    },
    {
      heading: "Reports",
      cards: [
        { label: "Reports released", value: String(d.reportsReleased), href: "/admin/reports" },
        { label: "Average condition score", value: d.averageScore === null ? "—" : d.averageScore.toFixed(1), detail: "released reports", href: "/admin/reports" },
        { label: "Reports corrected", value: String(d.reportsCorrected), detail: "changed before release", href: "/admin/reports" },
      ],
    },
    {
      heading: "Problems",
      cards: [
        { label: "Photos rejected", value: String(refusalTotal), detail: `last 7 days: ${refusalDetail(d.refusalsThisWeek)}`, href: "/admin/surveys" },
        { label: "Customers at the daily limit", value: String(d.customersAtLimit), detail: "analyses or new surveys, last 24 hours", href: "/admin/users" },
      ],
    },
    {
      heading: "Roofer introductions",
      cards: [{ label: "Roofer requests handled", value: String(d.rooferRequestsHandled), href: "/admin/roofer-requests" }],
    },
  ];
}
