// Pages a signed-in player can open before having a profile (sign-in, profile creation, auth
// routes, and the legal pages one reads before creating a profile).
const OPEN_PREFIXES = [
  "/bienvenue",
  "/connexion",
  "/auth",
  "/mentions-legales",
  "/confidentialite",
];

/** True when a signed-in player without profile must be sent to the profile creation page. */
export function requiresProfile(pathname: string): boolean {
  return !OPEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const BACK_OFFICE = "/admin/tableau-de-bord";

/**
 * Where an admin lands after signing in: the back-office, unless they asked for one of its pages.
 * An admin may then browse the player side and come back (decision of 8 Nov 2026).
 */
export function adminLanding(next: string): string {
  return next === "/admin" || next.startsWith("/admin/") || next.startsWith("/admin?")
    ? next
    : BACK_OFFICE;
}
