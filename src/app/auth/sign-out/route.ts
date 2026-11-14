import { NextResponse, type NextRequest } from "next/server";

import { signOutSession } from "@/infra";

import { DEMO_AS_COOKIE, DEMO_RETURN_COOKIE } from "../../demo-login";
import { getSessionClient } from "../../session";

/** POST only: a link or a prefetch must never sign someone out. */
export async function POST(request: NextRequest) {
  await signOutSession(await getSessionClient());
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
  // Signing out of a demo session (#637) ends it too: no banner, no way back left behind.
  response.cookies.delete(DEMO_RETURN_COOKIE);
  response.cookies.delete(DEMO_AS_COOKIE);
  return response;
}
