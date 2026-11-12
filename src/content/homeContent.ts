// The homepage's words (BL-059 / SPEC-018). At launch only the customer
// self-upload journey is on (BL-058), so the copy describes exactly what a
// launch customer can do. The drone and roofer sections stay in the page and
// come back when their journey switch is turned on. The copy is checked for
// forbidden claims in homeContent.test.ts.
import type { JourneySwitches } from "@/lib/journeys";

type Switches = Pick<JourneySwitches, "droneEnabled" | "rooferEnabled">;

export const SITE_TITLE = "SkyVault — AI roof health reports from your own photos";
export const SITE_DESCRIPTION =
  "Photograph your roof with our guided checklist and get a free AI roof health report, checked by our team and emailed to you as a PDF.";

export type Step = { step: string; title: string; desc: string };
export type Plan = {
  name: string;
  price: string;
  note: string;
  features: string[];
  cta: string;
  featured: boolean;
};
export type FooterLink = { href: string; label: string };

export type HomeContent = {
  hero: { eyebrow: string; body: string };
  steps: Step[];
  pricing: { intro: string; plans: Plan[] };
  showRooferSection: boolean;
  showDroneOperatorSection: boolean;
  footerLinks: FooterLink[];
};

const HERO = {
  eyebrow: "For homeowners",
  body:
    "Photograph your roof with your phone, following our guided checklist. Our AI analyses the photos and our team " +
    "checks every report before it's released, then we email it to you with a PDF. Free.",
};

const STEPS: Step[] = [
  {
    step: "1",
    title: "Photograph your roof",
    desc:
      "Use your phone and our guided checklist: ridge, front and rear slopes, gutters, chimney and flashings. We'll " +
      "tell you straight away if a photo is too blurry or too small.",
  },
  {
    step: "2",
    title: "AI analysis, checked by our team",
    desc:
      "Our AI scores your roof's condition and lists each defect by priority and where it was seen. Our team checks " +
      "every report before it's released.",
  },
  {
    step: "3",
    title: "Your report by email",
    desc:
      "We email you when your report is ready, with the PDF attached. If you'd like, we can put you in touch with a " +
      "local roofer.",
  },
];

const SELF_UPLOAD: Plan = {
  name: "Self upload",
  price: "Free",
  note: "No card needed",
  features: [
    "Guided photo checklist",
    "AI roof health report, checked by our team",
    "PDF emailed to you",
    "We can put you in touch with a local roofer",
  ],
  cta: "Get started free",
  featured: false,
};

// Shown only while the drone journey is on (unchanged from before launch).
const DRONE_CAPTURE: Plan = {
  name: "Drone Capture",
  price: "£89",
  note: "One-time per property",
  features: ["Licensed drone pilot dispatched", "Professional aerial imagery", "Full AI analysis report", "Results within 48 hours"],
  cta: "Book a drone survey",
  featured: true,
};

export function homeContent(switches: Switches): HomeContent {
  const footerLinks: FooterLink[] = [
    ...(switches.rooferEnabled ? [{ href: "#roofers", label: "For roofers" }] : []),
    ...(switches.droneEnabled ? [{ href: "#operators", label: "For drone operators" }] : []),
    { href: "/login", label: "Sign in" },
  ];
  return {
    hero: HERO,
    steps: STEPS,
    pricing: switches.droneEnabled
      ? { intro: "Free self-upload surveys. Paid drone capture for professional imagery.", plans: [SELF_UPLOAD, DRONE_CAPTURE] }
      : { intro: "Free self-upload roof reports.", plans: [SELF_UPLOAD] },
    showRooferSection: switches.rooferEnabled,
    showDroneOperatorSection: switches.droneEnabled,
    footerLinks,
  };
}
