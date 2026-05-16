import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUS_COLOURS: Record<string, string> = {
  posted:          "bg-blue-100 text-blue-700",
  accepted:        "bg-amber-100 text-amber-700",
  in_progress:     "bg-amber-100 text-amber-700",
  images_uploaded: "bg-green-100 text-green-700",
  complete:        "bg-gray-100 text-gray-600",
};

export default async function OperatorDashboard() {
  const session = await auth();
  const userId = session!.user.id;

  const [available, myJobs] = await Promise.all([
    // All posted jobs — available to accept
    prisma.droneJob.findMany({
      where: { status: "posted" },
      include: { survey: { include: { property: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Jobs this operator has accepted or completed
    prisma.droneJob.findMany({
      where: { operatorId: userId },
      include: { survey: { include: { property: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Operator Dashboard</h1>
      <p className="text-gray-500 mb-8">Drone capture jobs</p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border rounded-xl p-6">
          <p className="text-sm text-gray-500">Available jobs</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{available.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-6">
          <p className="text-sm text-gray-500">My active jobs</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {myJobs.filter((j) => ["accepted", "in_progress"].includes(j.status)).length}
          </p>
        </div>
      </div>

      {/* Available jobs */}
      {available.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Available jobs</h2>
          <div className="space-y-3">
            {available.map((job) => (
              <Link
                key={job.id}
                href={`/drone/jobs/${job.id}`}
                className="flex items-center justify-between bg-white border rounded-xl px-5 py-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">{job.survey.property.address}</p>
                  <p className="text-sm text-gray-500">{job.survey.property.postcode}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-600">£{Number(job.payoutAmount).toFixed(2)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">View job →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {available.length === 0 && (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400 mb-8">
          No jobs available right now — check back soon.
        </div>
      )}

      {/* My jobs */}
      {myJobs.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">My jobs</h2>
          <div className="space-y-3">
            {myJobs.map((job) => (
              <Link
                key={job.id}
                href={`/drone/jobs/${job.id}`}
                className="flex items-center justify-between bg-white border rounded-xl px-5 py-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">{job.survey.property.address}</p>
                  <p className="text-sm text-gray-500">{job.survey.property.postcode}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLOURS[job.status] ?? ""}`}>
                  {job.status.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
