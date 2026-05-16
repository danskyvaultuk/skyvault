const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@skyvault.co.uk";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
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
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[resend] Failed to send email to ${to}:`, body);
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
  const leadUrl = `${APP_URL}/roofer/leads/${leadId}`;

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

export async function notifyCustomerReportReady({
  customerEmail,
  customerName,
  surveyId,
}: {
  customerEmail: string;
  customerName: string;
  surveyId: string;
}) {
  const reportUrl = `${APP_URL}/surveys/${surveyId}/report`;

  await sendEmail({
    to: customerEmail,
    subject: "Your roof survey report is ready — SkyVault",
    html: `
      <p>Hi ${customerName ?? "there"},</p>
      <p>Your roof survey has been analysed by our AI and your report is ready to view.</p>
      <p><a href="${reportUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View your report →</a></p>
      <p style="color:#6b7280;font-size:12px;">SkyVault — AI-powered roof surveys</p>
    `,
  });
}
