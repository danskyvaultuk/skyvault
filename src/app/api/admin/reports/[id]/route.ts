import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildReportReview, reviewResponse } from "@/lib/reportReviewRuntime";

// Save an admin correction to a report (BL-015 / BL-061). Admin only.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body: unknown = await req.json().catch(() => null);
  return reviewResponse(await buildReportReview().correct(id, body));
}
