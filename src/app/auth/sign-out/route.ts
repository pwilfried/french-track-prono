import { NextResponse, type NextRequest } from "next/server";

import { signOutSession } from "@/infra";

import { getSessionClient } from "../../session";

/** POST only: a link or a prefetch must never sign someone out. */
export async function POST(request: NextRequest) {
  await signOutSession(await getSessionClient());
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
}
