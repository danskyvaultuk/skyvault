// The base address for links in SkyVault emails (BL-062). The configured
// address wins; without one, the Vercel production address, so an email
// never points at a developer's own machine on the live site. BL-069 also
// reports where the address came from, for the admin dashboard.

type AppUrlEnv = {
  NEXT_PUBLIC_APP_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
};

export type AppUrlSource = "NEXT_PUBLIC_APP_URL" | "VERCEL_PROJECT_PRODUCTION_URL" | "localhost-default";

export type SourcedUrl = { url: string; source: AppUrlSource };

export function appBaseUrlWithSource(env: AppUrlEnv): SourcedUrl {
  const configured = env.NEXT_PUBLIC_APP_URL;
  const production = env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configured) return { url: configured.replace(/\/+$/, ""), source: "NEXT_PUBLIC_APP_URL" };
  if (production) return { url: `https://${production}`.replace(/\/+$/, ""), source: "VERCEL_PROJECT_PRODUCTION_URL" };
  return { url: "http://localhost:3000", source: "localhost-default" };
}

export function appBaseUrl(env: AppUrlEnv): string {
  return appBaseUrlWithSource(env).url;
}
