// The legal part of the public footers (BL-057 / SPEC-024 D2, E1): links to the
// Terms and Privacy notice, and the copyright line. SkyVault is not a limited
// company, so the line names it as plain "SkyVault".
import Link from "next/link";

export function LegalFooter() {
  return (
    <>
      <div className="flex justify-center gap-6 mb-2 text-xs">
        <Link href="/terms" className="hover:text-gray-900">Terms &amp; Conditions</Link>
        <Link href="/privacy" className="hover:text-gray-900">Privacy notice</Link>
      </div>
      <p>© 2026 SkyVault. All rights reserved.</p>
    </>
  );
}
