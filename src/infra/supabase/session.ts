import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { limitedFetch } from "./limited-fetch";

export type CookieToSet = { name: string; value: string; options: CookieOptions };

/** What the session client needs from the framework: read all cookies, write some. */
export type CookieAdapter = {
  getAll(): { name: string; value: string }[];
  setAll(cookies: CookieToSet[]): void;
};

/** The signed-in user; the e-mail is only shown to the player themselves (#341). */
export type CurrentUser = { userId: string; email: string };

/** Supabase client bound to the visitor's cookies. Anon key only: safe next to the app. */
export function createSessionClient(cookies: CookieAdapter): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing (see .env.example)");
  return createServerClient(url, key, {
    global: { fetch: limitedFetch() },
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (toSet) => {
        try {
          cookies.setAll(toSet);
        } catch {
          // Server Components cannot write cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** The signed-in user, checked with the auth server (never trusts the cookie alone). */
export async function readCurrentUser(client: SupabaseClient): Promise<CurrentUser | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? "" };
}

/** Turns the link of the e-mail into a session. Works in any browser (no stored verifier). */
export async function exchangeEmailLink(client: SupabaseClient, tokenHash: string): Promise<boolean> {
  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  return !error && !!data.session;
}

export async function signOutSession(client: SupabaseClient): Promise<void> {
  await client.auth.signOut();
}

/** The refresh token of the session in the cookies (#637: kept to come back to it), or null. */
export async function currentRefreshToken(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.refresh_token ?? null;
}

/** Puts a session back in the cookies from its refresh token; false if it no longer works. */
export async function restoreSession(client: SupabaseClient, refreshToken: string): Promise<boolean> {
  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  return !error && !!data.session;
}
