// Where to send someone after they sign in (BL-062). A signed-out visitor who
// asked for a page — say the report linked from an email — is sent to sign in
// with that page as the return address. Only a path on SkyVault itself is
// allowed, so a crafted link can never use sign-in to send people elsewhere.

export const DEFAULT_RETURN_PATH = "/auth/redirect";
export const RETURN_PARAM = "callbackUrl";

export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/")) return null;
  // `//host` and `/\host` are read by browsers as another site.
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  const path = value.split("?")[0];
  if (path === "/login" || path.startsWith("/login/")) return null;
  return value;
}

export function signInReturnPath(value: string | null | undefined): string {
  return safeReturnPath(value) ?? DEFAULT_RETURN_PATH;
}

export function loginPathFor(pathname: string, search: string): string {
  const params = new URLSearchParams({ [RETURN_PARAM]: `${pathname}${search}` });
  return `/login?${params.toString()}`;
}
