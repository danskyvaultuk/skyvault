import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { PRIVACY_SECTIONS } from "@/content/legal/privacy";

export const metadata: Metadata = { title: "Privacy notice — SkyVault" };

// Public: readable without signing in (BL-057 / SPEC-024 A1).
export default function PrivacyPage() {
  return <LegalDocument title="Privacy notice" sections={PRIVACY_SECTIONS} />;
}
