import { NextResponse, type NextRequest } from "next/server";

import { lookUpProfile } from "@/application/get-profile";
import { requiresProfile } from "@/domain/profile-gate";
import { createSessionClient, createSupabaseProfileRepository, readCurrentUser } from "@/infra";

import { canonicalUrl } from "./app/canonical-host";
import { forwardedHeaders, type ProxiedSession } from "./app/proxied-session";

/**
 * Refreshes the session cookie on every page request, so the visitor stays signed in, and hands
 * the page the user it checked (#1021): the page does not ask the auth server again.
 */
export async function proxy(request: NextRequest) {
  // #1145: the production Vercel address goes to the site address, where the captcha works.
  const canonical = canonicalUrl(
    request.nextUrl,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_ENV,
  );
  if (canonical) return NextResponse.redirect(canonical, 308);

  let response = NextResponse.next({ request });
  const client = createSessionClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      for (const { name, value } of cookies) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
    },
  });
  const user = await readCurrentUser(client);

  // A signed-in player without profile must create one before using the app.
  const { pathname, search } = request.nextUrl;
  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target);
    // Keep the refreshed session cookies on the redirect.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };
  const session: ProxiedSession = { user };
  if (user && requiresProfile(pathname)) {
    // If the profile cannot be read, let the page load rather than block everyone.
    const profile = await lookUpProfile({
      profiles: createSupabaseProfileRepository(client),
    }).execute({ userId: user.userId });
    if (profile === null) {
      const target = new URL("/bienvenue", request.url);
      target.searchParams.set("next", pathname + search);
      return redirectTo(target);
    }
    if (profile !== "unavailable") session.profile = profile;
  }
  // Built last: the session cookies may have been refreshed above.
  const refreshed = response;
  response = NextResponse.next({
    request: { headers: forwardedHeaders(request.headers, request.method, session) },
  });
  for (const cookie of refreshed.cookies.getAll()) response.cookies.set(cookie);
  // Tells the service worker whether this page may be kept for offline use (visitors only).
  response.headers.set("x-ftp-viewer", user ? "player" : "visitor");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|brand/|sw.js|offline.html|monitoring).*)",
  ],
};
