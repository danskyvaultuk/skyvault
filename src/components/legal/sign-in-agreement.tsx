// The agreement shown beside the sign-in options (BL-057 / SPEC-024 D1): using
// SkyVault means agreeing to the Terms, having read the Privacy notice.
import Link from "next/link";

export function SignInAgreement() {
  return (
    <p className="text-xs text-gray-500 text-center mt-4">
      By continuing, you agree to our{" "}
      <Link href="/terms" className="underline hover:text-gray-700">Terms &amp; Conditions</Link>{" "}
      and confirm you&apos;ve read our{" "}
      <Link href="/privacy" className="underline hover:text-gray-700">Privacy notice</Link>.
    </p>
  );
}
