import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedReadUrl } from "@/lib/r2";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

// Severity badge colours
const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-blue-100 text-blue-700",
  low:      "bg-gray-100 text-gray-600",
};

function ScoreGauge({ score }: { score: number }) {
  const colour =
    score <= 3 ? "text-red-600" :
    score <= 6 ? "text-amber-500" :
    score <= 9 ? "text-blue-600" : "text-green-600";

  const label =
    score <= 3 ? "Replace soon" :
    score <= 6 ? "Repair needed" :
    score <= 9 ? "Maintenance recommended" : "Excellent condition";

  return (
    <div className="flex items-center gap-6">
      <div className={`text-6xl font-bold ${colour}`}>{score}<span className="text-2xl text-gray-400">/10</span></div>
      <div>
        <p className={`text-lg font-semibold ${colour}`}>{label}</p>
        <p className="text-sm text-gray-500">Roof condition score</p>
      </div>
    </div>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  // Load survey + report + property together
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      property: true,
      report: true,
    },
  });

  if (!survey) notFound();
  if (survey.customerId !== session.user.id && session.user.role !== "admin") notFound();
  if (!survey.report) redirect(`/surveys/${surveyId}`);

  const report = survey.report;

  // Parse JSON fields from the database
  const defects = (report.defectsJson as Array<{
    type: string; severity: string; description: string; image_index: number;
  }>);
  const recommendations = report.recommendations as string[];

  // Generate a presigned URL for the PDF download (valid 1 hour)
  const pdfUrl = report.pdfS3Key
    ? await getPresignedReadUrl(report.pdfS3Key, 3600)
    : null;

  return (
    <div className="p-8 max-w-3xl">
      {/* Back link */}
      <Link href={`/surveys/${surveyId}`} className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        ← Back to survey
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Roof Health Report</h1>
        <p className="text-gray-500">{survey.property.address}, {survey.property.postcode}</p>
        <p className="text-xs text-gray-400 mt-1">
          Generated {new Date(report.createdAt).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric",
          })}
        </p>
      </div>

      {/* Urgent banner */}
      {(report.defectsJson as { urgent_action_required?: boolean }[] | { urgent_action_required?: boolean })
        && (report.rawAiResponse as { urgent_action_required?: boolean })?.urgent_action_required && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6">
          <p className="text-red-700 font-semibold">⚠ Urgent action required</p>
          <p className="text-red-600 text-sm mt-1">
            This roof has critical defects. Please contact a qualified roofer as soon as possible.
          </p>
        </div>
      )}

      {/* Score card */}
      <div className="bg-white border rounded-xl px-6 py-6 mb-6">
        <ScoreGauge score={report.conditionScore} />
        <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t">
          {report.estimatedRemainingLife !== null && (
            <div>
              <p className="text-sm text-gray-500">Estimated remaining life</p>
              <p className="text-xl font-semibold text-gray-900">{report.estimatedRemainingLife} years</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500">AI confidence</p>
            <p className="text-xl font-semibold text-gray-900 capitalize">{report.confidence}</p>
          </div>
        </div>
      </div>

      {/* Surveyor notes */}
      {(report.rawAiResponse as { surveyor_notes?: string })?.surveyor_notes && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm font-medium text-blue-800 mb-1">Surveyor notes</p>
          <p className="text-sm text-blue-700">
            {(report.rawAiResponse as { surveyor_notes: string }).surveyor_notes}
          </p>
        </div>
      )}

      {/* Defects */}
      {defects && defects.length > 0 && (
        <div className="bg-white border rounded-xl mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Defects found ({defects.length})</h2>
          </div>
          <div className="divide-y">
            {defects.map((d, i) => (
              <div key={i} className="px-5 py-4 flex items-start gap-4">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${SEVERITY_STYLES[d.severity] ?? SEVERITY_STYLES.low}`}>
                  {d.severity}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {d.type.replace(/_/g, " ")}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{d.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-white border rounded-xl mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Recommendations</h2>
          </div>
          <ul className="divide-y">
            {recommendations.map((r, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3 text-sm text-gray-700">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* PDF download */}
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800"
        >
          Download PDF report
        </a>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-6">
        This report is AI-generated and intended as a guide only. It should be verified by a
        qualified roofing professional before any work is commissioned.
      </p>
    </div>
  );
}
