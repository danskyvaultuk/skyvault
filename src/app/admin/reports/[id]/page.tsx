import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPresignedReadUrl } from "@/lib/r2";
import { isReportReleased } from "@/lib/reportRelease";
import { ReportCorrectionSchema, type ReportCorrection } from "@/lib/reportCorrection";
import { ReviewForm } from "./review-form";

type AiAnswer = { condition_score?: number; defects?: ReportCorrection["defects"]; recommendations?: string[]; surveyor_notes?: string };

const STATUS_LABEL = {
  draft: { label: "Held — customer cannot see it", colour: "bg-amber-100 text-amber-700" },
  published: { label: "Released as the AI wrote it", colour: "bg-green-100 text-green-700" },
  overridden: { label: "Released with your corrections", colour: "bg-blue-100 text-blue-700" },
} as const;

// The current report as the form will edit it. A stored value that no longer
// fits the correction rules falls back to an empty list rather than crashing.
function currentValues(report: { conditionScore: number; defectsJson: unknown; recommendations: unknown; adminNotes: string | null }): ReportCorrection {
  const defects = ReportCorrectionSchema.shape.defects.safeParse(report.defectsJson);
  const recommendations = ReportCorrectionSchema.shape.recommendations.safeParse(report.recommendations);
  return {
    conditionScore: report.conditionScore,
    defects: defects.success ? defects.data : [],
    recommendations: recommendations.success ? recommendations.data : [],
    adminNotes: report.adminNotes,
  };
}

function AiOriginal({ ai }: { ai: AiAnswer }) {
  return (
    <details className="bg-white border rounded-xl px-5 py-4 mb-6">
      <summary className="font-semibold text-gray-900 cursor-pointer">The AI&apos;s original answer</summary>
      <div className="mt-4 space-y-3 text-sm text-gray-700">
        <p><span className="font-medium">Score:</span> {ai.condition_score ?? "—"}/10</p>
        <div>
          <p className="font-medium">Defects</p>
          <ul className="list-disc pl-5">
            {(ai.defects ?? []).map((d, i) => (
              <li key={i}>[{d.severity}] {d.type.replace(/_/g, " ")} — {d.description} (photo {d.image_index + 1})</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium">Recommendations</p>
          <ul className="list-disc pl-5">
            {(ai.recommendations ?? []).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
        {ai.surveyor_notes && <p><span className="font-medium">Surveyor notes:</span> {ai.surveyor_notes}</p>}
      </div>
    </details>
  );
}

export default async function ReviewReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      survey: {
        include: {
          property: { select: { address: true, postcode: true } },
          customer: { select: { name: true, email: true } },
          images: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!report) notFound();

  const { survey } = report;
  const [imageUrls, pdfUrl] = await Promise.all([
    Promise.all(survey.images.map((img) => getPresignedReadUrl(img.s3Key, 3600))),
    report.pdfS3Key ? getPresignedReadUrl(report.pdfS3Key, 3600) : Promise.resolve(null),
  ]);
  const status = STATUS_LABEL[report.status];
  const ai = (report.rawAiResponse ?? {}) as AiAnswer;

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Link href="/admin/reports" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Reports to review
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">{survey.property.address}</h1>
      <p className="text-gray-500">
        {survey.property.postcode} · {survey.customer.name ?? "—"} ({survey.customer.email})
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-3 mb-6">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.colour}`}>{status.label}</span>
        <Link href={`/surveys/${report.surveyId}/report`} className="text-sm text-blue-600 hover:underline">
          Open the customer&apos;s view →
        </Link>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
            Download PDF →
          </a>
        )}
      </div>

      {imageUrls.length > 0 && (
        <div className="bg-white border rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Photos ({imageUrls.length})</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {imageUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border" />
                <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 rounded">{i + 1}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <AiOriginal ai={ai} />

      <ReviewForm
        reportId={report.id}
        held={!isReportReleased(report.status)}
        photoCount={imageUrls.length}
        initial={currentValues(report)}
      />
    </div>
  );
}
