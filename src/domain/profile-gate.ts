// Pages a signed-in player can open before having a profile (sign-in, profile creation, auth routes).
const OPEN_PREFIXES = ["/bienvenue", "/connexion", "/auth"];

/** True when a signed-in player without profile must be sent to the profile creation page. */
export function requiresProfile(pathname: string): boolean {
  return !OPEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
