// The privacy notice (BL-057 / SPEC-024 Part A), drafted from ICO guidance and
// the code as it stands. Keep the services list in step with the code.
import { OPERATOR, type LegalSection } from "@/content/legal/operator";

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    heading: "Who we are",
    paragraphs: [
      `SkyVault is run by ${OPERATOR.description}. ${OPERATOR.name} is responsible for your personal data (the "controller").`,
      `For anything about your data, including the requests below, email ${OPERATOR.contactEmail}.`,
    ],
  },
  {
    heading: "What we collect, and why",
    paragraphs: ["We collect only what we need to run your roof surveys:"],
    items: [
      "Your name and email address, and your Google account name and email if you sign in with Google: to create your account and sign you in. Lawful basis: to provide the service you asked for (contract).",
      "Property addresses and postcodes: to record which property each survey is for, and to find your address. Lawful basis: contract.",
      "Roof photos you upload, your survey notes and your answers about the roof: to analyse your roof and write your report. Lawful basis: contract.",
      "The reports we produce: so you can read and download them, and so we can check them before release. Lawful basis: contract.",
      "Roofer introduction requests: when you ask to be put in touch with a roofer, to pass your request on. Lawful basis: contract, at your request.",
      "Technical records of errors and sign-ins: to keep the service working and secure. Lawful basis: our legitimate interest in running a reliable, secure service.",
    ],
  },
  {
    heading: "Who we share it with",
    paragraphs: [
      "We do not sell your data. We use these services to run SkyVault, and each receives only what it needs:",
    ],
    items: [
      "Anthropic (AI analysis): your roof photos, survey notes and roof answers, to analyse the roof.",
      "Amazon Web Services: storage for your photos and report PDFs.",
      "Neon: our database, which holds your account, properties, surveys and reports.",
      "Ideal Postcodes: the postcode you search for, to list the addresses at it.",
      "Resend: your email address and the emails we send you, including your report.",
      "Google: your sign-in, if you choose to sign in with Google.",
      "Vercel: hosting for the website.",
      "Sentry: error reports, set up to leave out personal data such as names, email addresses and photos.",
    ],
  },
  {
    heading: "Roofer introductions",
    paragraphs: [
      "If you ask to be put in touch with a roofer, we pass your name, contact details, the property address and your report to the roofer we introduce you to.",
    ],
  },
  {
    heading: "Data outside the UK",
    paragraphs: [
      "Some of these services may process your data outside the UK, for example in the United States or the EU. Where they do, we rely on the safeguards UK data protection law requires.",
    ],
  },
  {
    heading: "How long we keep it",
    paragraphs: [
      "We keep your photos, reports and account details while your account exists. If you ask us to delete your data or close your account, we delete it within 30 days. Copies in backups are removed as those backups expire.",
    ],
  },
  {
    heading: "Your rights",
    paragraphs: [`Under UK GDPR you can ask us to do the following. To use any of these rights, email ${OPERATOR.contactEmail}.`],
    items: [
      "Give you a copy of your data (access).",
      "Correct data that is wrong (rectification).",
      "Delete your data (erasure).",
      "Restrict or object to how we use it.",
      "Give you your data in a form you can take elsewhere (portability).",
    ],
  },
  {
    heading: "Complaints",
    paragraphs: [
      "If you are unhappy with how we handle your data, please tell us first. You also have the right to complain to the Information Commissioner's Office (ICO), the UK's data protection regulator, at ico.org.uk or on 0303 123 1113.",
    ],
  },
  {
    heading: "Cookies",
    paragraphs: [
      "We use only the cookies needed to sign you in and keep you signed in. We do not use advertising or analytics cookies.",
    ],
  },
];
