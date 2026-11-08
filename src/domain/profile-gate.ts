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

// Pages an admin can open: the back-office, plus signing in and out (an admin only runs the game).
const ADMIN_PREFIXES = ["/admin", "/auth", "/connexion", "/bienvenue", "/au-revoir"];

/** True when an admin asking for this page must be sent to the back-office instead. */
export function sendsAdminToBackOffice(pathname: string): boolean {
  return !ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
