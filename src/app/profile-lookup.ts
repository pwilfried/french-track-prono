import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import { getProfile } from "@/application/get-profile";
import type { Profile } from "@/application/create-profile";
import { createSupabaseProfileRepository } from "@/infra";

/**
 * Profile of a signed-in player for the chrome of the app (proxy, header).
 * Returns "unavailable" when it cannot be read, so the page can still load.
 */
export async function lookUpProfile(
  client: SupabaseClient,
  userId: string,
): Promise<Profile | null | "unavailable"> {
  try {
    return await getProfile({ profiles: createSupabaseProfileRepository(client) }).execute({
      userId,
    });
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) return "unavailable";
    throw error;
  }
}
