// The report disclaimer on the report page (BL-057 / SPEC-024 C1), with a link
// to the Terms.
import Link from "next/link";
import { REPORT_DISCLAIMER } from "@/content/legal/disclaimer";

export function ReportDisclaimer() {
  return (
    <p className="text-xs text-gray-500 mt-6">
      {REPORT_DISCLAIMER}{" "}
      See our <Link href="/terms" className="underline hover:text-gray-700">Terms &amp; Conditions</Link>.
    </p>
  );
}
