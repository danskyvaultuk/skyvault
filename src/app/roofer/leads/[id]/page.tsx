import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ClaimButton } from "./claim-button";

const SCORE_COLOUR = (score: number) =>
  score <= 3 ? "text-red-600" : score <= 6 ? "text-amber-500" : "text-green-600";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-blue-100 text-blue-700",
  low:      "bg-gray-100 text-gray-600",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const [lead, subscription, existingClaim] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        report: true,
        survey: {
          include: {
            property: true,
            customer: { select: { name: true, email: true, phone: true } },
          },
        },
        _count: { select: { claims: true } },
      },
    }),
    prisma.subscription.findUnique({ where: { rooferId: userId } }),
    prisma.leadClaim.findUnique({ where: { leadId_rooferId: { leadId: id, rooferId: userId } } }),
  ]);

  if (!lead) notFound();

  const isSubscribed = subscription?.status === "active";
  const isClaimed = !!existingClaim;
  const isFull = lead._count.claims >= lead.maxRoofers && !isClaimed;

  const defects = lead.report.defectsJson as Array<{
    type: string; severity: string; description: string;
  }>;
  const recommendations = lead.report.recommendations as string[];
  const property = lead.survey.property;

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/roofer/leads" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        ← Back to leads
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isClaimed ? property.address : `${property.postcode} — ${property.type}`}
        </h1>
        <p className="text-gray-500">
          {isClaimed ? property.postcode : "Full address shown after claiming"}
        </p>
      </div>

      {/* Score */}
      <div className="bg-white border rounded-xl px-6 py-5 mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Condition score</p>
          <p className={`text-4xl font-bold ${SCORE_COLOUR(lead.report.conditionScore)}`}>
            {lead.report.conditionScore}<span className="text-xl text-gray-400">/10</span>
          </p>
        </div>
        <div className="text-right">
          {lead.report.estimatedRemainingLife && (
            <>
              <p className="text-sm text-gray-500">Est. remaining life</p>
              <p className="text-xl font-bold text-gray-900">{lead.report.estimatedRemainingLife} yrs</p>
            </>
          )}
          <p className="text-xs text-gray-400 mt-1">AI confidence: {lead.report.confidence}</p>
        </div>
      </div>

      {/* Defects */}
      {defects?.length > 0 && (
        <div className="bg-white border rounded-xl mb-5 overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Defects ({defects.length})</h2>
          </div>
          <div className="divide-y">
            {defects.map((d, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${SEVERITY_STYLES[d.severity] ?? ""}`}>
                  {d.severity}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">{d.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-500">{d.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations?.length > 0 && (
        <div className="bg-white border rounded-xl mb-5 overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Recommendations</h2>
          </div>
          <ul className="divide-y">
            {recommendations.map((r, i) => (
              <li key={i} className="px-5 py-3 text-sm text-gray-700 flex gap-2">
                <span className="text-blue-600 font-bold">•</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Customer contact — only shown after claiming */}
      {isClaimed && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-5">
          <h2 className="font-semibold text-green-800 mb-3">Customer contact</h2>
          <div className="space-y-1 text-sm text-gray-900">
            <p><span className="text-green-700 font-medium">Name:</span> {lead.survey.customer.name ?? "—"}</p>
            <p><span className="text-green-700 font-medium">Email:</span> {lead.survey.customer.email}</p>
            {lead.survey.customer.phone && (
              <p><span className="text-green-700 font-medium">Phone:</span> {lead.survey.customer.phone}</p>
            )}
            <p><span className="text-green-700 font-medium">Address:</span> {property.address}, {property.postcode}</p>
          </div>
        </div>
      )}

      {/* Claim button */}
      {!isClaimed && (
        <ClaimButton
          leadId={lead.id}
          isSubscribed={isSubscribed}
          isFull={isFull}
        />
      )}

      {isClaimed && (
        <div className="bg-gray-50 border rounded-xl px-5 py-3 text-sm text-gray-600 text-center">
          You have claimed this lead. Contact the customer above to arrange a quote.
        </div>
      )}
    </div>
  );
}
