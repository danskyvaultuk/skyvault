import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildReportReview, reviewResponse } from "@/lib/reportReviewRuntime";

// Re-send the "report ready" email for a released report (BL-063). Admin only.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  return reviewResponse(await buildReportReview().resendEmail(id));
}
