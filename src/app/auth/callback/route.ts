import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/domain/redirect";
import { exchangeEmailLink, readCurrentUser } from "@/infra";

import { landingAfterSignIn } from "../../landing";

import { getSessionClient } from "../../session";

/** Landing point of the e-mail link: ?token_hash=...&next=/some/path */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const next = safeRedirectPath(searchParams.get("next"));

  const client = await getSessionClient();
  if (tokenHash && (await exchangeEmailLink(client, tokenHash))) {
    // A new player is sent on to the profile creation by the proxy; an admin lands on the back-office.
    const user = await readCurrentUser(client);
    const target = user ? await landingAfterSignIn(client, user.userId, next) : next;
    return NextResponse.redirect(new URL(target, origin));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", origin));
}
