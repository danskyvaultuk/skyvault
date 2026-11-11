// The address login returns to (BL-069). Auth.js uses AUTH_URL, then
// NEXTAUTH_URL; with neither set it follows the address the visitor used
// (trustHost in src/lib/auth.ts). Reported for the admin dashboard only.

type AuthUrlEnv = { AUTH_URL?: string; NEXTAUTH_URL?: string };

export type AuthUrl =
  | { url: string; source: "AUTH_URL" | "NEXTAUTH_URL" }
  | { url: null; source: "visitor" };

export function authBaseUrl(env: AuthUrlEnv): AuthUrl {
  const authUrl = env.AUTH_URL?.trim();
  if (authUrl) return { url: authUrl.replace(/\/+$/, ""), source: "AUTH_URL" };
  const nextAuthUrl = env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl) return { url: nextAuthUrl.replace(/\/+$/, ""), source: "NEXTAUTH_URL" };
  return { url: null, source: "visitor" };
}
