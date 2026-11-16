// Public health check (BL-083 / SPEC-031): an uptime monitor loads it every few
// minutes. It never statically imports the libraries it checks; see healthCheck.ts.
import { NextResponse } from "next/server";
import { LAUNCH_CHECKS, runHealthChecks } from "@/lib/healthCheck";
import { reportError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runHealthChecks(LAUNCH_CHECKS, (error, check) => reportError(error, { what: "health-check", check }));
  return NextResponse.json(result.body, { status: result.httpStatus, headers: { "Cache-Control": "no-store" } });
}
