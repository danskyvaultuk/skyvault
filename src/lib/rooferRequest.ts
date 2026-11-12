// "Put me in touch with a roofer" (BL-060). A customer asks from a released
// report, with consent to share their details; the admin brokers it by hand.
// A request is the existing Lead record: one per survey, `open` until the
// admin marks it handled (`closed`). Its createdAt is the time of consent.
import type { LeadStatus, ReportStatus } from "@prisma/client";
import { isReportReleased } from "@/lib/reportRelease";
import { reportError } from "@/lib/monitoring";

export const DEFAULT_ADMIN_EMAIL = "dan@skyvaultuk.com";

export function adminEmailAddress(configured: string | undefined): string {
  return configured?.trim() || DEFAULT_ADMIN_EMAIL;
}

export type RequestSurvey = {
  id: string;
  customerId: string;
  property: { address: string; postcode: string };
  customer: { name: string | null; email: string };
  report: { id: string; status: ReportStatus } | null;
};

export type RooferRequestView = { status: LeadStatus; createdAt: Date };

export type AdminNotice = {
  customerName: string;
  customerEmail: string;
  address: string;
  postcode: string;
  surveyId: string;
};

export type RooferRequestDeps = {
  findSurvey(surveyId: string): Promise<RequestSurvey | null>;
  findRequest(surveyId: string): Promise<RooferRequestView | null>;
  createRequest(data: {
    surveyId: string;
    reportId: string;
    postcode: string;
    status: "open";
    createdAt: Date;
  }): Promise<RooferRequestView>;
  notifyAdmin(notice: AdminNotice): Promise<void>;
};

export type RooferRequestResult =
  | { outcome: "created" | "exists"; request: RooferRequestView }
  | { outcome: "consent-required" | "not-found" | "not-released" };

export class RooferRequests {
  constructor(private readonly deps: RooferRequestDeps) {}

  async request(surveyId: string, userId: string, consent: unknown): Promise<RooferRequestResult> {
    if (consent !== true) return { outcome: "consent-required" };

    const survey = await this.deps.findSurvey(surveyId);
    if (!survey || survey.customerId !== userId) return { outcome: "not-found" };
    if (!survey.report || !isReportReleased(survey.report.status)) return { outcome: "not-released" };

    const existing = await this.deps.findRequest(surveyId);
    if (existing) return { outcome: "exists", request: existing };

    const consentedAt = new Date();
    const request = await this.deps.createRequest({
      surveyId,
      reportId: survey.report.id,
      postcode: survey.property.postcode,
      status: "open",
      // The request is made at the moment the customer consents.
      createdAt: consentedAt,
    });
    await this.tellAdmin(survey);
    return { outcome: "created", request };
  }

  // The request is already recorded; a failed email must not lose it.
  private async tellAdmin(survey: RequestSurvey): Promise<void> {
    try {
      await this.deps.notifyAdmin({
        customerName: survey.customer.name ?? "",
        customerEmail: survey.customer.email,
        address: survey.property.address,
        postcode: survey.property.postcode,
        surveyId: survey.id,
      });
    } catch (err) {
      reportError(err, { what: "roofer-request-email-failed", surveyId: survey.id });
    }
  }
}
