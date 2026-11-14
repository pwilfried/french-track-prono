import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { DemoAccounts, DemoPlayer } from "@/application/demo-login";
import { isDemoEmail } from "@/domain/demo-player";

import { readAll } from "./read-all";

const USERS_PER_PAGE = 1000;

/**
 * Client with the service_role key, which bypasses row-level security and reaches the auth admin
 * API. SERVER ONLY (#637): never imported by a client component, never a NEXT_PUBLIC_ variable.
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** DemoAccounts on Supabase: auth admin API for the e-mails and the tokens, profiles for pseudos. */
export function createSupabaseDemoAccounts(service: SupabaseClient): DemoAccounts {
  async function pseudoOf(userId: string): Promise<string | null> {
    const { data, error } = await service
      .from("profiles")
      .select("pseudo")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(`profile of a demo account: ${error.message}`);
    return (data?.pseudo as string | undefined) ?? null;
  }

  async function emailOf(userId: string): Promise<string | null> {
    const { data, error } = await service.auth.admin.getUserById(userId);
    if (error || !data.user?.email) return null;
    return data.user.email;
  }

  return {
    async listDemoPlayers() {
      const emails = new Map<string, string>();
      for (let page = 1; ; page += 1) {
        const { data, error } = await service.auth.admin.listUsers({
          page,
          perPage: USERS_PER_PAGE,
        });
        if (error) throw new Error(`demo accounts: ${error.message}`);
        for (const user of data.users) {
          if (user.email && isDemoEmail(user.email)) emails.set(user.id, user.email);
        }
        if (data.users.length < USERS_PER_PAGE) break;
      }
      const profiles = await readAll<{ id: string; pseudo: string }>((from, to) =>
        service.from("profiles").select("id, pseudo").order("id").range(from, to),
      );
      if (profiles.error) throw new Error(`demo profiles: ${profiles.error.code}`);
      const players: DemoPlayer[] = [];
      for (const { id, pseudo } of profiles.data) {
        const email = emails.get(id);
        if (email) players.push({ userId: id, pseudo, email });
      }
      return players.sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"));
    },

    async find(userId) {
      const email = await emailOf(userId);
      if (!email) return null;
      const pseudo = await pseudoOf(userId);
      return pseudo === null ? null : { userId, pseudo, email };
    },

    async signInToken(userId) {
      const email = await emailOf(userId);
      if (!email) return null;
      // Makes a sign-in link without sending any e-mail; the app spends its token at once.
      const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
      if (error) return null;
      return data.properties?.hashed_token || null;
    },
  };
}
