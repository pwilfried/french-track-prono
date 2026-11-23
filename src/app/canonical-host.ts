/**
 * The production project also answers on its Vercel address (`<project>.vercel.app`), where the
 * Turnstile widget is not allowed and nobody can sign in (#1145). In production, a visit there is
 * sent to the same page on the site address. Pre-production (a separate project whose site
 * address is its own `.vercel.app` one) and preview deploys are left alone.
 */
export function canonicalUrl(
  url: URL,
  siteUrl: string | undefined,
  vercelEnv: string | undefined,
): URL | null {
  if (vercelEnv !== "production" || !siteUrl || !url.hostname.endsWith(".vercel.app")) return null;
  let site: URL;
  try {
    site = new URL(siteUrl);
  } catch {
    return null;
  }
  if (site.hostname === url.hostname || site.hostname.endsWith(".vercel.app")) return null;
  return new URL(url.pathname + url.search, site.origin);
}
