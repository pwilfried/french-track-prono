import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { sql } from "./database";
import { latestCodeFromMailbox } from "./mailbox";

/**
 * A real player of the local Supabase: signs in with the e-mail code and gets a profile.
 * Returns the client that carries their session.
 */
export async function signedInPlayer(
  url: string,
  key: string,
): Promise<{ userId: string; client: SupabaseClient }> {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `player-${crypto.randomUUID()}@example.test`;
  await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  const token = await latestCodeFromMailbox(email);
  const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) throw new Error(`could not sign the test player in: ${error?.message}`);
  const profile = await client.from("profiles").insert({
    id: data.user.id,
    pseudo: `Joueur ${crypto.randomUUID().slice(0, 8)}`,
    age_confirmed_at: new Date().toISOString(),
  });
  if (profile.error) throw new Error(`could not create the test profile: ${profile.error.message}`);
  return { userId: data.user.id, client };
}

/** A real player of French Track Manager: an admin, while the Manager is open to them only (#615). */
export async function signedInManagerPlayer(url: string, key: string) {
  const player = await signedInPlayer(url, key);
  sql(`update profiles set is_admin = true where id = '${player.userId}'`);
  return player;
}
