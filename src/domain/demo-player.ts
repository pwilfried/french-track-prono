/** The domain of every invented account (demo players, tests): never a real address. */
const DEMO_EMAIL_DOMAIN = "example.test";

/**
 * True for an invented account: a non-empty name and exactly the domain `example.test` (no
 * subdomain, nothing after it). Only such accounts can be signed in as from pre-production (#637).
 */
export function isDemoEmail(email: string): boolean {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  return at > 0 && address.slice(at + 1) === DEMO_EMAIL_DOMAIN;
}
