// The admin review step (BL-061 with BL-015): an admin corrects a report and
// approves it. Approval releases a held report and is the one place the
// customer's "report ready" email is sent. The AI's original answer
// (`rawAiResponse`) is never changed, so corrections can be compared with it.
import type { ReportStatus } from "@prisma/client";
import type { ReportAnalysis, RoofAnalysis } from "@/lib/claude";
import { RoofContextSchema, type RoofContext } from "@/lib/roofContext";
import { isReportReleased } from "@/lib/reportRelease";
import { ReportCorrectionSchema, type ReportCorrection } from "@/lib/reportCorrection";
import type { PreparedPhoto, SurveyPhoto } from "@/lib/surveyImages";
import { storedReviewFlags } from "@/lib/reviewFlags";
import { reportError } from "@/lib/monitoring";

export type ReviewReport = {
  id: string;
  surveyId: string;
  status: ReportStatus;
  conditionScore: number;
  defectsJson: unknown;
  recommendations: unknown;
  estimatedRemainingLife: number | null;
  confidence: string;
  rawAiResponse: unknown;
  adminNotes: string | null;
  pdfS3Key: string | null;
  survey: {
    notes: string | null;
    roofContext: unknown;
    property: { address: string; postcode: string };
    customer: { email: string; name: string | null };
    images: (SurveyPhoto & { roofParts?: string[] })[];
  };
};

export type ReportUpdate = {
  conditionScore?: number;
  defectsJson?: ReportCorrection["defects"];
  recommendations?: string[];
  adminNotes?: string | null;
  pdfS3Key?: string;
  status?: ReportStatus;
};

export type ReportReviewDeps = {
  findReport(id: string): Promise<ReviewReport | null>;
  updateReport(id: string, data: ReportUpdate): Promise<void>;
  fetchPhotos(photos: SurveyPhoto[]): Promise<PreparedPhoto[]>;
  renderPdf(
    analysis: ReportAnalysis,
    address: string,
    postcode: string,
    imageBase64s: string[],
    customerNotes: string | null,
    roofContext: RoofContext | null,
    photoRoofParts: readonly (readonly string[])[]
  ): Promise<Buffer>;
  storePdf(key: string, pdf: Buffer): Promise<void>;
  pdfKeyFor(surveyId: string): string;
  notifyCustomer(args: {
    customerEmail: string;
    customerName: string;
    surveyId: string;
    postcode: string;
    pdf: Buffer | null;
  }): Promise<void>;
  /** Reads a stored PDF, to attach it to the report ready email (BL-022). */
  readPdf(key: string): Promise<Buffer>;
};

export type ReviewResult =
  | { ok: true; status: ReportStatus }
  | { ok: false; reason: "invalid"; detail: unknown }
  | { ok: false; reason: "not-found" | "already-released" | "held" };

type AiAnswer = Partial<RoofAnalysis>;

function aiAnswer(report: Pick<ReviewReport, "rawAiResponse">): AiAnswer {
  const raw = report.rawAiResponse;
  return raw && typeof raw === "object" ? (raw as AiAnswer) : {};
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** True when an admin changed the report away from the AI's answer, or left notes on it. */
export function wasCorrected(report: ReviewReport): boolean {
  const ai = aiAnswer(report);
  return (
    report.conditionScore !== ai.condition_score ||
    !sameJson(report.defectsJson, ai.defects) ||
    !sameJson(report.recommendations, ai.recommendations) ||
    !!report.adminNotes?.trim()
  );
}

function confidenceOf(value: string): RoofAnalysis["confidence"] {
  return value === "low" || value === "high" ? value : "medium";
}

export class ReportReview {
  constructor(private readonly deps: ReportReviewDeps) {}

  async correct(reportId: string, input: unknown): Promise<ReviewResult> {
    const parsed = ReportCorrectionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, reason: "invalid", detail: parsed.error.flatten() };

    const report = await this.deps.findReport(reportId);
    if (!report) return { ok: false, reason: "not-found" };

    const pdfS3Key = await this.remakePdf(report, parsed.data);
    const released = isReportReleased(report.status);
    await this.deps.updateReport(report.id, {
      conditionScore: parsed.data.conditionScore,
      defectsJson: parsed.data.defects,
      recommendations: parsed.data.recommendations,
      adminNotes: parsed.data.adminNotes || null,
      pdfS3Key,
      // A correction to a report the customer can already see is an override.
      // It is applied quietly: no email.
      ...(released ? { status: "overridden" as const } : {}),
    });
    return { ok: true, status: released ? "overridden" : report.status };
  }

  async approve(reportId: string): Promise<ReviewResult> {
    const report = await this.deps.findReport(reportId);
    if (!report) return { ok: false, reason: "not-found" };
    if (isReportReleased(report.status)) return { ok: false, reason: "already-released" };

    const status: ReportStatus = wasCorrected(report) ? "overridden" : "published";
    await this.deps.updateReport(report.id, { status });
    await this.emailCustomer(report);
    return { ok: true, status };
  }

  /**
   * Sends the "report ready" email again for a report the customer can
   * already see (BL-063), for instance after a lost email or a broken link.
   * Changes nothing on the report. A held report is released by approval.
   */
  async resendEmail(reportId: string): Promise<ReviewResult> {
    const report = await this.deps.findReport(reportId);
    if (!report) return { ok: false, reason: "not-found" };
    if (!isReportReleased(report.status)) return { ok: false, reason: "held" };

    await this.emailCustomer(report);
    return { ok: true, status: report.status };
  }

  private async emailCustomer(report: ReviewReport): Promise<void> {
    await this.deps.notifyCustomer({
      customerEmail: report.survey.customer.email,
      customerName: report.survey.customer.name ?? "",
      surveyId: report.surveyId,
      postcode: report.survey.property.postcode,
      pdf: await this.storedPdf(report),
    });
  }

  /** The stored PDF to attach (BL-022), or null: the email never waits on it. */
  private async storedPdf(report: ReviewReport): Promise<Buffer | null> {
    if (!report.pdfS3Key) {
      console.warn(`[review] Report ${report.id} has no stored PDF; emailing the link alone`);
      return null;
    }
    try {
      return await this.deps.readPdf(report.pdfS3Key);
    } catch (err) {
      reportError(err, { what: "report-pdf-unreadable", reportId: report.id, note: "emailing the link alone" });
      return null;
    }
  }

  private async remakePdf(report: ReviewReport, correction: ReportCorrection): Promise<string> {
    const { survey } = report;
    const photos = await this.deps.fetchPhotos(survey.images);
    const roofContext = RoofContextSchema.safeParse(survey.roofContext);
    const pdf = await this.deps.renderPdf(
      this.correctedAnalysis(report, correction),
      survey.property.address,
      survey.property.postcode,
      photos.map((p) => p.base64),
      survey.notes,
      roofContext.success ? roofContext.data : null,
      survey.images.map((img) => img.roofParts ?? [])
    );
    const key = report.pdfS3Key ?? this.deps.pdfKeyFor(report.surveyId);
    await this.deps.storePdf(key, pdf);
    return key;
  }

  private correctedAnalysis(report: ReviewReport, correction: ReportCorrection): ReportAnalysis {
    const ai = aiAnswer(report);
    return {
      condition_score: correction.conditionScore,
      defects: correction.defects,
      recommendations: correction.recommendations,
      estimated_remaining_life_years: report.estimatedRemainingLife,
      confidence: confidenceOf(report.confidence),
      urgent_action_required: ai.urgent_action_required ?? false,
      surveyor_notes: ai.surveyor_notes ?? "",
      // The AI's flags are kept as it raised them; the admin does not edit them (SPEC-013).
      review_flags: storedReviewFlags(report.rawAiResponse),
    };
  }
}
