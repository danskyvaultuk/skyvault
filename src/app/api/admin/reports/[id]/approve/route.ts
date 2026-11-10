import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildReportReview, reviewResponse } from "@/lib/reportReviewRuntime";

// Approve a held report: releases it to the customer and sends the one
// "report ready" email (BL-061). Admin only.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  return reviewResponse(await buildReportReview().approve(id));
}
