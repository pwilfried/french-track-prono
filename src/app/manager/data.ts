import { redirect } from "next/navigation";

import { createSupabaseManagerLeagueRepository } from "@/infra";

import { getCurrentUser, getSessionClient } from "../session";

/** The signed-in player and their Manager leagues; a visitor goes to the sign-in first. */
export async function managerPorts(back: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(back)}`);
  return {
    userId: user.userId,
    managerLeagues: createSupabaseManagerLeagueRepository(await getSessionClient()),
  };
}
