// The admin's email alerts (BL-084 / SPEC-032 C1–C3): a new user, and a report
// waiting for approval. Each is on unless its setting is "off", goes to the
// admin address used for roofer requests, and never breaks what triggered it: a
// failure is caught and reported with an id only, no name or address.
import { notifyAdminNewUser, notifyAdminReportWaiting } from "@/lib/resend";
import { adminEmailAddress } from "@/lib/rooferRequest";
import { reportError } from "@/lib/monitoring";

type AlertEnv = {
  SKYVAULT_ADMIN_EMAIL?: string;
  SKYVAULT_ALERT_NEW_USER?: string;
  SKYVAULT_ALERT_REPORT_WAITING?: string;
};

function settings(): AlertEnv {
  return {
    SKYVAULT_ADMIN_EMAIL: process.env.SKYVAULT_ADMIN_EMAIL,
    SKYVAULT_ALERT_NEW_USER: process.env.SKYVAULT_ALERT_NEW_USER,
    SKYVAULT_ALERT_REPORT_WAITING: process.env.SKYVAULT_ALERT_REPORT_WAITING,
  };
}

export function alertEnabled(setting: string | undefined): boolean {
  return setting?.trim().toLowerCase() !== "off";
}

export type NewUser = { id?: string; name?: string | null; email?: string | null; role?: string };

export async function alertNewUser(user: NewUser, env: AlertEnv = settings()): Promise<void> {
  if (!alertEnabled(env.SKYVAULT_ALERT_NEW_USER)) return;
  try {
    await notifyAdminNewUser({
      to: adminEmailAddress(env.SKYVAULT_ADMIN_EMAIL),
      name: user.name ?? null,
      email: user.email ?? "(no email)",
      role: user.role ?? "customer",
    });
  } catch (error) {
    reportError(error, { what: "admin-alert-failed", alert: "new-user", userId: user.id });
  }
}

export type WaitingReport = {
  reportId: string;
  address: string;
  postcode: string;
  customer: string;
  conditionScore: number;
  urgent: boolean;
};

export async function alertReportWaiting(report: WaitingReport, env: AlertEnv = settings()): Promise<void> {
  if (!alertEnabled(env.SKYVAULT_ALERT_REPORT_WAITING)) return;
  try {
    await notifyAdminReportWaiting({ to: adminEmailAddress(env.SKYVAULT_ADMIN_EMAIL), ...report });
  } catch (error) {
    reportError(error, { what: "admin-alert-failed", alert: "report-waiting", reportId: report.reportId });
  }
}
