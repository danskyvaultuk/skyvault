// Wires ReportReview to the real database, storage, PDF renderer and email.
import { prisma } from "@/lib/prisma";
import { generatePdfKey, uploadBuffer } from "@/lib/r2";
import { renderReportPDF } from "@/lib/pdf";
import { notifyCustomerReportReady } from "@/lib/resend";
import { fetchSurveyPhotos } from "@/lib/surveyImages";
import { ReportReview, type ReviewResult } from "@/lib/reportReview";
import { NextResponse } from "next/server";

export function buildReportReview(): ReportReview {
  return new ReportReview({
    findReport: (id) =>
      prisma.report.findUnique({
        where: { id },
        include: {
          survey: {
            select: {
              notes: true,
              roofContext: true,
              property: { select: { address: true, postcode: true } },
              customer: { select: { email: true, name: true } },
              images: { orderBy: { sortOrder: "asc" }, select: { s3Key: true, originalFilename: true } },
            },
          },
        },
      }),
    updateReport: async (id, data) => {
      await prisma.report.update({ where: { id }, data });
    },
    fetchPhotos: fetchSurveyPhotos,
    renderPdf: renderReportPDF,
    storePdf: (key, pdf) => uploadBuffer(key, pdf, "application/pdf"),
    pdfKeyFor: generatePdfKey,
    notifyCustomer: notifyCustomerReportReady,
  });
}

const FAILURE_STATUS = { invalid: 400, "not-found": 404, "already-released": 409, held: 409 } as const;

/** The HTTP answer for a review result. */
export function reviewResponse(result: ReviewResult): NextResponse {
  if (result.ok) return NextResponse.json({ status: result.status });
  const body = result.reason === "invalid" ? { error: "Invalid correction", detail: result.detail } : { error: result.reason };
  return NextResponse.json(body, { status: FAILURE_STATUS[result.reason] });
}
