import { NextResponse, type NextRequest } from "next/server";

import { restoreSession, signOutSession } from "@/infra";

import { DEMO_RETURN_COOKIE, demoLoginEnabled, endDemoSession } from "../../demo-login";
import { getSessionClient } from "../../session";

/**
 * « Revenir à mon compte » (#637): the admin's own session comes back; else, signed out. A route
 * with a 303, not a server action: the page after it must be loaded with the admin's cookies,
 * whereas the render that follows a server action's redirect still sees the demo player's.
 */
export async function POST(request: NextRequest) {
  if (!demoLoginEnabled()) return new NextResponse(null, { status: 404 });
  const adminToken = request.cookies.get(DEMO_RETURN_COOKIE)?.value;
  const client = await getSessionClient();
  const restored = !!adminToken && (await restoreSession(client, adminToken));
  if (!restored) await signOutSession(client);
  const target = restored ? "/admin/joueurs-demo" : "/connexion";
  const response = NextResponse.redirect(new URL(target, request.nextUrl.origin), 303);
  endDemoSession(response);
  return response;
}
