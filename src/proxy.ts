import { NextResponse, type NextRequest } from "next/server";

import { requiresProfile, sendsAdminToBackOffice } from "@/domain/profile-gate";
import { createSessionClient, createSupabaseProfileRepository, readCurrentUser } from "@/infra";

import { lookUpProfile } from "./app/profile-lookup";

/** Refreshes the session cookie on every page request, so the visitor stays signed in. */
export async function proxy(request: NextRequest) {
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
  if (user && requiresProfile(pathname)) {
    // If the profile cannot be read, let the page load rather than block everyone.
    const profile = await lookUpProfile(client, user.userId);
    if (profile === null) {
      const target = new URL("/bienvenue", request.url);
      target.searchParams.set("next", pathname + search);
      return redirectTo(target);
    }
    // An admin only runs the game: every player page leads to the back-office.
    if (profile !== "unavailable" && sendsAdminToBackOffice(pathname)) {
      const admin = await createSupabaseProfileRepository(client)
        .isAdmin(user.userId)
        .catch(() => false);
      if (admin) return redirectTo(new URL("/admin/competitions", request.url));
    }
  }
  // Tells the service worker whether this page may be kept for offline use (visitors only).
  response.headers.set("x-ftp-viewer", user ? "player" : "visitor");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|brand/|sw.js|offline.html).*)",
  ],
};
