"use client";

// Sign out in one click (BL-078 / SPEC-027 F1, SEED-027). It posts to the
// sign-in library with its anti-forgery token, so no other site can sign a user
// out, and lands on the home page with no "Are you sure?" page.
import { signOut } from "next-auth/react";

export const SIGN_OUT_DESTINATION = "/";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => signOut({ redirectTo: SIGN_OUT_DESTINATION })} className={className}>
      Sign out
    </button>
  );
}
