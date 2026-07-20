const LOCAL_SITE_URL = "http://localhost:3000";

function normalizeSiteUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use http or https.");
  }
  return url.origin;
}

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return normalizeSiteUrl(configured);

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelHost) return normalizeSiteUrl(`https://${vercelHost}`);

  return LOCAL_SITE_URL;
}

export function mcpEndpointUrl(): string {
  return `${siteUrl()}/api/mcp`;
}
