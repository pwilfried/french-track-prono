// After signing in without a page asked for, a player lands on the home (#369).
const DEFAULT_FALLBACK = "/";

/**
 * Accepts only a path inside the app ("/something", optionally with a query).
 * Anything else (other sites, protocol-relative URLs, backslashes, control characters,
 * encoded slashes at the start) is replaced by the fallback.
 */
export function safeRedirectPath(
  input: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (!input || !input.startsWith("/")) return fallback;
  if (input.startsWith("//") || input.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(input)) return fallback;
  if (/^\/(%2f|%5c)/i.test(input)) return fallback;
  try {
    if (new URL(input, "http://app.test").origin !== "http://app.test") return fallback;
  } catch {
    return fallback;
  }
  return input;
}

/** The slug of the event page a path points to (`/epreuves/<slug>`), null for any other page. */
export function eventSlugOfPath(path: string): string | null {
  const match = /^\/epreuves\/([^/?#]+)\/?(?:[?#].*)?$/.exec(path);
  return match ? match[1] : null;
}

/**
 * Where the back link of an athlete's page leads when he was opened from a podium being built
 * (#699): the event page `from` points to, or null when `from` is anything else.
 */
export function eventReturnPath(from: string | null | undefined): string | null {
  const path = safeRedirectPath(from, "");
  const slug = path ? eventSlugOfPath(path) : null;
  return slug && /^[a-z0-9-]+$/i.test(slug) ? `/epreuves/${slug}` : null;
}
