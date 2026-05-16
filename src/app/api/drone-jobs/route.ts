import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "drone" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // For MVP: operators see all posted jobs + their own accepted/in-progress jobs
  // Post-MVP: filter by postcode prefix match
  const jobs = await prisma.droneJob.findMany({
    where:
      session.user.role === "admin"
        ? {}
        : {
            OR: [
              { status: "posted" },                          // available to anyone
              { operatorId: session.user.id },               // their own jobs
            ],
          },
    include: {
      survey: {
        include: { property: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jobs);
}
