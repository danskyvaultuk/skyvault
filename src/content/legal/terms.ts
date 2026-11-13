// The Terms & Conditions (BL-057 / SPEC-024 Part B): a draft for a solicitor to
// check before SkyVault charges money or launches publicly.
import { OPERATOR, type LegalSection } from "@/content/legal/operator";

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    heading: "About these terms",
    paragraphs: [
      `SkyVault is run by ${OPERATOR.description}. These terms apply when you use SkyVault. By continuing to use it, you agree to them.`,
      `Questions about these terms: ${OPERATOR.contactEmail}.`,
    ],
  },
  {
    heading: "What a SkyVault report is",
    paragraphs: [
      "A SkyVault report is an AI-assisted visual assessment of the photos you upload. It is not a professional or structural survey, and it is not a physical inspection of your roof.",
      "It can only describe what your photos show, so it may miss defects that are not visible in them. A qualified roofer should check your roof before you decide on or commission any work.",
    ],
  },
  {
    heading: "Your responsibilities",
    paragraphs: ["When you use SkyVault, you agree that:"],
    items: [
      "You will only upload photos you are entitled to share, of a property you own or have permission to survey.",
      "You will never climb onto a roof or put yourself or anyone else at risk to take photos. Take them from the ground, a window or another safe place.",
      "The information you give us is accurate, as far as you know.",
    ],
  },
  {
    heading: "Our liability",
    paragraphs: [
      "Because a report is based only on your photos, we are not responsible for decisions you make, or work you commission, based on a report without having the roof checked by a qualified roofer.",
      "Nothing in these terms excludes or limits our liability where the law does not allow it to be excluded or limited, including for death or personal injury caused by our negligence, or for fraud.",
      "Your statutory rights as a consumer are not affected.",
    ],
  },
  {
    heading: "Changes and availability",
    paragraphs: [
      "We may change or pause the service, or update these terms. If we change them, we will update the date at the top of this page.",
    ],
  },
  {
    heading: "Law",
    paragraphs: ["These terms are governed by the law of England and Wales."],
  },
];
