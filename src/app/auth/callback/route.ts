import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/domain/redirect";
import { exchangeEmailLink } from "@/infra";

import { getSessionClient } from "../../session";

/** Landing point of the e-mail link: ?token_hash=...&next=/some/path */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const next = safeRedirectPath(searchParams.get("next"));

  if (tokenHash && (await exchangeEmailLink(await getSessionClient(), tokenHash))) {
    return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", origin));
}
