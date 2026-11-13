import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { TERMS_SECTIONS } from "@/content/legal/terms";

export const metadata: Metadata = { title: "Terms & Conditions — SkyVault" };

// Public: readable without signing in (BL-057 / SPEC-024 B1).
export default function TermsPage() {
  return <LegalDocument title="Terms & Conditions" sections={TERMS_SECTIONS} />;
}
