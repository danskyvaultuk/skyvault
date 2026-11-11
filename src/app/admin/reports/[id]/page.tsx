import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPresignedReadUrl } from "@/lib/r2";
import { isReportReleased } from "@/lib/reportRelease";
import { correctionValues, type ReportCorrection } from "@/lib/reportCorrection";
import { ReviewForm } from "./review-form";
import { customerDefects } from "@/lib/defectDisplay";

type AiAnswer = {
  condition_score?: number;
  ai_condition_score?: number;
  defects?: ReportCorrection["defects"];
  recommendations?: string[];
  surveyor_notes?: string;
};

const STATUS_LABEL = {
  draft: { label: "Held — customer cannot see it", colour: "bg-amber-100 text-amber-700" },
  published: { label: "Released as the AI wrote it", colour: "bg-green-100 text-green-700" },
  overridden: { label: "Released with your corrections", colour: "bg-blue-100 text-blue-700" },
} as const;

function AiOriginal({ ai }: { ai: AiAnswer }) {
  return (
    <details className="bg-white border rounded-xl px-5 py-4 mb-6">
      <summary className="font-semibold text-gray-900 cursor-pointer">The AI&apos;s original answer</summary>
      <div className="mt-4 space-y-3 text-sm text-gray-700">
        <p>
          <span className="font-medium">Score:</span> {ai.condition_score ?? "—"}/10
          {ai.ai_condition_score !== undefined && (
            <span className="text-amber-700"> (capped by the safety rule; the AI gave {ai.ai_condition_score}/10)</span>
          )}
        </p>
        <div>
          <p className="font-medium">Defects</p>
          <ul className="list-disc pl-5">
            {(ai.defects ?? []).map((d, i) => (
              <li key={i}>
                [{d.priority ?? "no priority"} · severity {d.severity} · {d.category ?? "—"} · {d.extent ?? "—"}]{" "}
                {d.type.replace(/_/g, " ")} — {d.description} (photo {d.image_index + 1}
                {d.location ? `: ${d.location}` : ""})
              </li>
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

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

type Preview = {
  values: ReportCorrection;
  photoRoofParts: string[][];
  remainingLife: number | null;
  confidence: string;
  surveyorNotes?: string;
  pdfUrl: string | null;
};

// The report exactly as the customer will see it once released: the saved
// (corrected) values, not the AI's original.
function CustomerPreview({ preview }: { preview: Preview }) {
  const { values } = preview;
  return (
    <div className="bg-white border rounded-xl p-5 mb-6 space-y-4">
      <h2 className="font-semibold text-gray-900">What the customer will see</h2>
      <div className="flex flex-wrap gap-6 text-sm">
        <p><span className="text-3xl font-bold text-gray-900">{values.conditionScore}</span><span className="text-gray-400">/10</span></p>
        {preview.remainingLife !== null && <p className="text-gray-600">Remaining life: {preview.remainingLife} years</p>}
        <p className="text-gray-600 capitalize">AI confidence: {preview.confidence}</p>
      </div>
      {preview.surveyorNotes && <p className="text-sm text-blue-800 bg-blue-50 rounded-lg px-3 py-2">{preview.surveyorNotes}</p>}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Defects found ({values.defects.length})</p>
        <ul className="space-y-2">
          {customerDefects(values.defects, preview.photoRoofParts).map((d, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_STYLES[d.key] ?? PRIORITY_STYLES.low}`}>{d.label}</span>
              <span className="text-gray-800">
                <span className="font-medium">{d.typeText}</span> — {d.description}
                <span className="block text-xs text-gray-500">{d.locationText}</span>
                {d.categoryText && <span className="block text-xs text-gray-400">{d.categoryText}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Recommendations</p>
        <ol className="list-decimal pl-5 text-sm text-gray-800 space-y-1">
          {values.recommendations.map((r, i) => <li key={i}>{r}</li>)}
        </ol>
      </div>
      {preview.pdfUrl && (
        <a href={preview.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-blue-600 hover:underline">
          Download the PDF →
        </a>
      )}
    </div>
  );
}

export default async function ReviewReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") redirect("/login");

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
  const values = correctionValues(report);

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

      <CustomerPreview
        preview={{
          values,
          photoRoofParts: survey.images.map((img) => img.roofParts),
          remainingLife: report.estimatedRemainingLife,
          confidence: report.confidence,
          surveyorNotes: ai.surveyor_notes,
          pdfUrl,
        }}
      />

      <AiOriginal ai={ai} />

      <ReviewForm
        reportId={report.id}
        held={!isReportReleased(report.status)}
        photoCount={imageUrls.length}
        initial={values}
      />
    </div>
  );
}
