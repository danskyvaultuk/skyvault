import { appBaseUrl } from "@/lib/appUrl";
import { reportError } from "@/lib/monitoring";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@skyvaultuk.com";
const APP_URL = appBaseUrl({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
});

// Every link in a SkyVault email is built here, from the live base address.
function appLink(path: string): string {
  return `${APP_URL}${path}`;
}

type EmailAttachment = { filename: string; content: Buffer };

async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}) {
  if (!RESEND_API_KEY) {
    // Log in dev so we can see what would be sent without a real key
    console.log(`[resend] No API key — skipping email to ${to}: "${subject}"`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      // Resend takes each attachment's content as Base64.
      ...(attachments?.length
        ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) }
        : {}),
    }),
  });

  if (!res.ok) {
    // The provider's reply can quote the recipient, so it stays in the server log;
    // Sentry gets the subject and status only, never an address (SPEC-020 B3).
    console.error(`[resend] Provider reply for "${subject}":`, await res.text());
    reportError(new Error(`Email failed to send (status ${res.status})`), { what: "email-failed", subject });
  }
}

// ── Email templates ─────────────────────────────────────────────────────────

export async function notifyRooferNewLead({
  rooferEmail,
  rooferName,
  leadId,
  postcode,
}: {
  rooferEmail: string;
  rooferName: string;
  leadId: string;
  postcode: string;
}) {
  const leadUrl = appLink(`/roofer/leads/${leadId}`);

  await sendEmail({
    to: rooferEmail,
    subject: `New roof survey lead in ${postcode} — SkyVault`,
    html: `
      <p>Hi ${rooferName},</p>
      <p>A new roof survey has been completed near <strong>${postcode}</strong> and is ready for you to claim.</p>
      <p>View the lead report and claim it before it fills up:</p>
      <p><a href="${leadUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View lead →</a></p>
      <p style="color:#6b7280;font-size:12px;">You received this because you have an active SkyVault subscription with a matching postcode area.</p>
    `,
  });
}

// BL-022: the largest PDF attached to the report ready email. Resend allows
// 40 MB per email after Base64 encoding, which grows a file by a third; 20 MB
// raw stays well inside that. A larger PDF is left off and the link carries the report.
export const MAX_REPORT_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function reportAttachment(pdf: Buffer | null, postcode: string, surveyId: string): EmailAttachment | null {
  if (!pdf) return null;
  if (pdf.length > MAX_REPORT_ATTACHMENT_BYTES) {
    console.warn(
      `[resend] Report PDF for survey ${surveyId} is ${pdf.length} bytes, over the ${MAX_REPORT_ATTACHMENT_BYTES}-byte limit; sending the link alone`
    );
    return null;
  }
  return { filename: `SkyVault-roof-report-${postcode.replace(/\s+/g, "")}.pdf`, content: pdf };
}

export async function notifyCustomerReportReady({
  customerEmail,
  customerName,
  surveyId,
  postcode,
  pdf,
}: {
  customerEmail: string;
  customerName: string;
  surveyId: string;
  postcode: string;
  /** The stored report PDF, attached when present and within the limit (BL-022). */
  pdf: Buffer | null;
}) {
  const reportUrl = appLink(`/surveys/${surveyId}/report`);
  const attachment = reportAttachment(pdf, postcode, surveyId);

  await sendEmail({
    to: customerEmail,
    subject: "Your roof survey report is ready — SkyVault",
    html: `
      <p>Hi ${customerName ?? "there"},</p>
      <p>Your roof survey has been analysed by our AI and your report is ready to view.</p>
      ${attachment ? "<p>Your report is also attached to this email as a PDF.</p>" : ""}
      <p><a href="${reportUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View your report →</a></p>
      <p style="color:#6b7280;font-size:12px;">SkyVault — AI-powered roof surveys</p>
    `,
    ...(attachment ? { attachments: [attachment] } : {}),
  });
}

// A customer asked to be put in touch with a roofer (BL-060).
export async function notifyAdminRooferRequest({
  to,
  customerName,
  customerEmail,
  address,
  postcode,
  surveyId,
}: {
  to: string;
  customerName: string;
  customerEmail: string;
  address: string;
  postcode: string;
  surveyId: string;
}) {
  const reportUrl = appLink(`/surveys/${surveyId}/report`);
  const requestsUrl = appLink("/admin/roofer-requests");

  await sendEmail({
    to,
    subject: `Roofer request: ${address}, ${postcode} — SkyVault`,
    html: `
      <p>A customer has asked to be put in touch with a roofer, and agreed that SkyVault may share their name, email, address and report.</p>
      <p><strong>${customerName || "(no name)"}</strong> — ${customerEmail}<br/>${address}, ${postcode}</p>
      <p><a href="${reportUrl}">View the report →</a></p>
      <p><a href="${requestsUrl}">All roofer requests →</a></p>
    `,
  });
}
