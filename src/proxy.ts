import { NextResponse, type NextRequest } from "next/server";

import { createSessionClient, readCurrentUser } from "@/infra";

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
  await readCurrentUser(client);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)"],
};
