// Admin only (BL-054 / SPEC-020 C): throws a known error inside a real request,
// so Sentry's request hook reports it the way it would a genuine failure. Used
// to prove the live setup from the admin dashboard.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  throw new Error(`Sentry test error ${new Date().toISOString()}`);
}
