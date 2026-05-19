import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SCORE_COLOUR = (score: number) =>
  score <= 3 ? "text-red-600" : score <= 6 ? "text-amber-500" : "text-green-600";

const STATUS_BADGE: Record<string, { label: string; colour: string }> = {
  draft:     { label: "Draft",       colour: "bg-gray-100 text-gray-600" },
  pending:   { label: "Pending",     colour: "bg-amber-100 text-amber-700" },
  analysing: { label: "Analysing…",  colour: "bg-blue-100 text-blue-700" },
  complete:  { label: "Report ready",colour: "bg-green-100 text-green-700" },
  failed:    { label: "Failed",      colour: "bg-red-100 text-red-700" },
};

export default async function SurveysPage() {
  const session = await auth();
  const surveys = await prisma.survey.findMany({
    where: { customerId: session!.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      property: { select: { address: true, postcode: true } },
      report: { select: { conditionScore: true } },
      lead: { include: { _count: { select: { claims: true } } } },
    },
  });

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Surveys</h1>
        <Link
          href="/surveys/new"
          className="bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-800"
        >
          New survey
        </Link>
      </div>

      {surveys.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center">
          <p className="text-gray-500 mb-4">No surveys yet.</p>
          <Link
            href="/surveys/new"
            className="inline-block bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800"
          >
            Start your first survey →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map((survey) => {
            const badge = STATUS_BADGE[survey.status] ?? STATUS_BADGE.draft;
            const claimCount = survey.lead?._count.claims ?? 0;
            const href = survey.status === "complete"
              ? `/surveys/${survey.id}/report`
              : `/surveys/${survey.id}`;

            return (
              <Link
                key={survey.id}
                href={href}
                className="flex items-center justify-between bg-white border rounded-xl px-5 py-4 hover:bg-gray-50 transition gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{survey.property.address}</p>
                  <p className="text-xs text-gray-400 mb-1">{survey.property.postcode}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.colour}`}>
                      {badge.label}
                    </span>
                    {claimCount > 0 && (
                      <span className="text-xs text-green-600 font-medium">
                        {claimCount} roofer{claimCount !== 1 ? "s" : ""} interested
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {survey.report ? (
                    <>
                      <p className={`text-2xl font-bold ${SCORE_COLOUR(survey.report.conditionScore)}`}>
                        {survey.report.conditionScore}/10
                      </p>
                      <p className="text-xs text-gray-400">condition</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">
                      {new Date(survey.createdAt).toLocaleDateString("en-GB")}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
