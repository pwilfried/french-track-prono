import { getCommunity, type Community } from "@/application/community";
import { UseCaseError } from "@/application/errors";
import { createSupabaseCommunityRepository, createSupabaseLeagueMomentRepository } from "@/infra";

import { loadMyLeagues } from "./competition";
import { getSessionClient } from "./session";

/**
 * The « Dans ma communauté » block of the signed-in player (#673): the latest `momentLimit`
 * moments of all their leagues, the announcements and the polls. Null when it cannot be read.
 */
export async function loadCommunity(momentLimit: number): Promise<Community | null> {
  const [client, leagues] = await Promise.all([getSessionClient(), loadMyLeagues()]);
  try {
    return await getCommunity({
      moments: createSupabaseLeagueMomentRepository(client),
      community: createSupabaseCommunityRepository(client),
    }).execute({ leagues: leagues.map(({ id, name }) => ({ id, name })), momentLimit });
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}
