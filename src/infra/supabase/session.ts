import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CookieToSet = { name: string; value: string; options: CookieOptions };

/** What the session client needs from the framework: read all cookies, write some. */
export type CookieAdapter = {
  getAll(): { name: string; value: string }[];
  setAll(cookies: CookieToSet[]): void;
};

export type CurrentUser = { userId: string };

/** Supabase client bound to the visitor's cookies. Anon key only: safe next to the app. */
export function createSessionClient(cookies: CookieAdapter): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing (see .env.example)");
  return createServerClient(url, key, {
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
  return { userId: data.user.id };
}

/** Turns the link of the e-mail into a session. Works in any browser (no stored verifier). */
export async function exchangeEmailLink(client: SupabaseClient, tokenHash: string): Promise<boolean> {
  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  return !error && !!data.session;
}

export async function signOutSession(client: SupabaseClient): Promise<void> {
  await client.auth.signOut();
}
