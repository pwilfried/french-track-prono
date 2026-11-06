import { NextResponse, type NextRequest } from "next/server";

import { UseCaseError } from "@/application/errors";
import { getProfile } from "@/application/get-profile";
import { requiresProfile } from "@/domain/profile-gate";
import { createSessionClient, createSupabaseProfileRepository, readCurrentUser } from "@/infra";

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
  if (user && requiresProfile(pathname)) {
    const profile = await getProfile({ profiles: createSupabaseProfileRepository(client) })
      .execute({ userId: user.userId })
      // If the profile cannot be read, let the page load rather than block everyone.
      .catch((error: unknown) =>
        error instanceof UseCaseError ? "unknown" : Promise.reject(error),
      );
    if (profile === null) {
      const target = new URL("/bienvenue", request.url);
      target.searchParams.set("next", pathname + search);
      const redirect = NextResponse.redirect(target);
      // Keep the refreshed session cookies on the redirect.
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      return redirect;
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)"],
};
