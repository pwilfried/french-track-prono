import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseProfileRepository } from "@/infra";

/** Whether the signed-in user runs the game; false when it cannot be read. */
export const isAdmin = (client: SupabaseClient, userId: string) =>
  createSupabaseProfileRepository(client)
    .isAdmin(userId)
    .catch(() => false);
