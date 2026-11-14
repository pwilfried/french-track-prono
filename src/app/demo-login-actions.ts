"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { signInAsDemoPlayer } from "@/application/demo-login";
import {
  createServiceRoleClient,
  createSupabaseDemoAccounts,
  createSupabaseProfileRepository,
  currentRefreshToken,
  exchangeEmailLink,
  restoreSession,
  signOutSession,
} from "@/infra";

import { DEMO_AS_COOKIE, DEMO_RETURN_COOKIE, demoLoginEnabled } from "./demo-login";
import { getCurrentUser, getSessionClient } from "./session";

const PAGE = "/admin/joueurs-demo";
const cookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Pre-production only (#637): the admin's session is kept in an httpOnly cookie, then the demo
 * player's session takes its place. All of it on the server; the service key never leaves it.
 */
export async function signInAsDemoAction(formData: FormData): Promise<void> {
  const enabled = demoLoginEnabled();
  if (!enabled) notFound();
  const user = await getCurrentUser();
  if (!user) notFound();
  const client = await getSessionClient();
  let signIn: { token: string; pseudo: string };
  try {
    signIn = await signInAsDemoPlayer({
      enabled,
      profiles: createSupabaseProfileRepository(client),
      demo: createSupabaseDemoAccounts(createServiceRoleClient()),
    }).execute({ userId: user.userId, targetId: String(formData.get("userId") ?? "") });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "NOT_ADMIN" || error.code === "DEMO_LOGIN_DISABLED") notFound();
    redirect(`${PAGE}?erreur=${error.code}`);
  }
  const adminToken = await currentRefreshToken(client);
  if (!adminToken || !(await exchangeEmailLink(client, signIn.token))) {
    redirect(`${PAGE}?erreur=AUTH_UNAVAILABLE`);
  }
  const store = await cookies();
  store.set(DEMO_RETURN_COOKIE, adminToken, { ...cookieOptions, httpOnly: true });
  // Next encodes the value itself: encoding it here too would show « E2E%20demo » in the banner.
  store.set(DEMO_AS_COOKIE, signIn.pseudo, cookieOptions);
  redirect("/");
}

/** « Revenir à mon compte »: the admin's own session comes back; else, signed out. */
export async function returnToMyAccountAction(): Promise<void> {
  if (!demoLoginEnabled()) notFound();
  const store = await cookies();
  const adminToken = store.get(DEMO_RETURN_COOKIE)?.value;
  store.delete(DEMO_RETURN_COOKIE);
  store.delete(DEMO_AS_COOKIE);
  const client = await getSessionClient();
  if (adminToken && (await restoreSession(client, adminToken))) redirect(PAGE);
  await signOutSession(client);
  redirect("/connexion");
}
