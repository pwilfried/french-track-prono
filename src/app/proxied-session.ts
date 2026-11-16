import type { Profile } from "@/application/create-profile";
import type { CurrentUser } from "@/infra";

/**
 * Internal request header through which the proxy hands the user it checked to the page (#1021),
 * so the page does not ask the auth server again. The proxy always removes the one sent by the
 * browser: a visitor cannot pass for a player.
 */
export const SESSION_HEADER = "x-ftp-session";

/** What the proxy checked: the user (null for a visitor) and, when it read it, their profile. */
export type ProxiedSession = { user: CurrentUser | null; profile?: Profile | null };

type Wire = {
  user: CurrentUser | null;
  profile?: { pseudo: string; bib: Profile["bib"]; ageConfirmedAt: string } | null;
};

/**
 * The request headers the proxy forwards to the app: the browser's ones without its session
 * header, plus the proxy's own. Only for page loads (GET, HEAD): server actions and other writes
 * check the user again, and may change the profile before the page renders.
 */
export function forwardedHeaders(
  incoming: Headers,
  method: string,
  session: ProxiedSession,
): Headers {
  const headers = new Headers(incoming);
  headers.delete(SESSION_HEADER);
  if (method !== "GET" && method !== "HEAD") return headers;
  const wire: Wire = { user: session.user };
  if (session.user && session.profile !== undefined) {
    wire.profile = session.profile && {
      pseudo: session.profile.pseudo,
      bib: session.profile.bib,
      ageConfirmedAt: session.profile.ageConfirmedAt.toISOString(),
    };
  }
  // Header values are ASCII: the e-mail or the pseudo may not be.
  headers.set(SESSION_HEADER, encodeURIComponent(JSON.stringify(wire)));
  return headers;
}

/** The session set by the proxy, or undefined when it did not set one (check with the auth server). */
export function readProxiedSession(headers: Headers): ProxiedSession | undefined {
  const value = headers.get(SESSION_HEADER);
  if (value === null) return undefined;
  try {
    const wire = JSON.parse(decodeURIComponent(value)) as Wire;
    if (!wire.user) return { user: null };
    const user = { userId: wire.user.userId, email: wire.user.email };
    if (wire.profile === undefined) return { user };
    if (wire.profile === null) return { user, profile: null };
    return {
      user,
      profile: {
        userId: user.userId,
        pseudo: wire.profile.pseudo,
        bib: wire.profile.bib,
        ageConfirmedAt: new Date(wire.profile.ageConfirmedAt),
      },
    };
  } catch {
    return undefined;
  }
}
