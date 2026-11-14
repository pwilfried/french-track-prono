/**
 * Signing in as a demo player (#637) exists only in pre-production: the server-side variable
 * PREPROD_DEMO_LOGIN=1 is set in the pre-production Vercel project, never in production. Without
 * it the page answers « introuvable » and the menu has no link to it.
 */
export function demoLoginEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PREPROD_DEMO_LOGIN === "1";
}

/** httpOnly cookie: the admin's own refresh token, to come back to their account. */
export const DEMO_RETURN_COOKIE = "ftp-demo-return";
/** Readable cookie: the pseudo of the demo player, shown by the banner (nothing secret). */
export const DEMO_AS_COOKIE = "ftp-demo-as";

/** Reads the pseudo of the demo player from `document.cookie`, or null outside a demo session. */
export function demoPseudoFrom(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== DEMO_AS_COOKIE) continue;
    try {
      return decodeURIComponent(rest.join("=")) || null;
    } catch {
      return null;
    }
  }
  return null;
}
