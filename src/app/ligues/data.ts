import { redirect } from "next/navigation";

import { createSupabaseLeagueRepository, createSupabaseRankingRepository } from "@/infra";

import { getCurrentUser, getSessionClient } from "../session";

/** The signed-in player and the league ports acting as them; a visitor goes to the sign-in first. */
export async function leaguePorts(back: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(back)}`);
  const client = await getSessionClient();
  return {
    userId: user.userId,
    leagues: createSupabaseLeagueRepository(client),
    ranking: createSupabaseRankingRepository(client),
  };
}
