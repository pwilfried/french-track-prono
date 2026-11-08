import type { SupabaseClient } from "@supabase/supabase-js";

import { adminLanding } from "@/domain/profile-gate";
import { createSupabaseProfileRepository } from "@/infra";

/** Whether the signed-in user runs the game; false when it cannot be read. */
export const isAdmin = (client: SupabaseClient, userId: string) =>
  createSupabaseProfileRepository(client)
    .isAdmin(userId)
    .catch(() => false);

/** The page a player with a profile lands on after signing in: an admin goes to the back-office. */
export async function landingAfterSignIn(
  client: SupabaseClient,
  userId: string,
  next: string,
): Promise<string> {
  return (await isAdmin(client, userId)) ? adminLanding(next) : next;
}
