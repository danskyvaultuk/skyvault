// The base address for links in SkyVault emails (BL-062). The configured
// address wins; without one, the Vercel production address, so an email
// never points at a developer's own machine on the live site.

type AppUrlEnv = {
  NEXT_PUBLIC_APP_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
};

export function appBaseUrl(env: AppUrlEnv): string {
  const configured = env.NEXT_PUBLIC_APP_URL;
  const production = env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = configured || (production ? `https://${production}` : "http://localhost:3000");
  return base.replace(/\/+$/, "");
}
