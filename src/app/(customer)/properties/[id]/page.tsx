import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

const STATUS_COLOURS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  pending:   "bg-amber-100 text-amber-700",
  analysing: "bg-blue-100 text-blue-700",
  complete:  "bg-green-100 text-green-700",
  failed:    "bg-red-100 text-red-700",
};

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      surveys: {
        orderBy: { createdAt: "desc" },
        include: { report: { select: { conditionScore: true } } },
      },
    },
  });

  if (!property || property.ownerId !== session!.user.id) notFound();

  return (
    <div className="p-8 max-w-2xl">
      {/* Back */}
      <Link href="/properties" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        ← Properties
      </Link>

      {/* Property header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{property.address}</h1>
        <p className="text-gray-500">{property.postcode}{property.town ? ` · ${property.town}` : ""}</p>
        <span className="inline-block mt-2 text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full capitalize">
          {property.type}
        </span>
      </div>

      {/* Start new survey CTA */}
      <div className="mb-6">
        <Link
          href={`/surveys/new`}
          className="inline-block bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800"
        >
          + New survey for this property
        </Link>
      </div>

      {/* Surveys list */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Surveys</h2>

      {property.surveys.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
          No surveys yet for this property.
        </div>
      ) : (
        <div className="space-y-3">
          {property.surveys.map((s) => (
            <Link
              key={s.id}
              href={s.status === "complete" ? `/surveys/${s.id}/report` : `/surveys/${s.id}`}
              className="flex items-center justify-between bg-white border rounded-xl px-5 py-4 hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {s.type.replace("_", " ")}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(s.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {s.report?.conditionScore !== undefined && (
                  <span className="text-sm font-bold text-gray-700">
                    {s.report.conditionScore}/10
                  </span>
                )}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLOURS[s.status] ?? STATUS_COLOURS.draft}`}>
                  {s.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
