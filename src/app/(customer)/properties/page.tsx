import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PropertiesPage() {
  const session = await auth();
  const properties = await prisma.property.findMany({
    where: { ownerId: session!.user.id },
    include: { surveys: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
        <Link
          href="/properties/new"
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800"
        >
          Add property
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center">
          <p className="text-gray-600 mb-4">No properties yet.</p>
          <Link href="/properties/new" className="text-blue-700 font-medium hover:underline">
            Add your first property →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/properties/${p.id}`}
              className="bg-white border rounded-xl px-6 py-5 hover:bg-gray-50 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-gray-900">{p.address}</p>
                <p className="text-sm text-gray-500">
                  {p.postcode} · {p.type} · {p.surveys.length} survey{p.surveys.length !== 1 ? "s" : ""}
                </p>
              </div>
              <span className="text-sm text-gray-400">View →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
