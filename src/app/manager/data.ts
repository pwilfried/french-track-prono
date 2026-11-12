import { notFound, redirect } from "next/navigation";

import { createSupabaseManagerLeagueRepository } from "@/infra";

import { canSeeManager } from "../manager-access";
import { getCurrentUser, getSessionClient } from "../session";

/**
 * The signed-in player and their Manager leagues; a visitor goes to the sign-in first. Null for a
 * player who does not see the Manager (#615).
 */
export async function managerAccess(back: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(back)}`);
  if (!(await canSeeManager(user.userId))) return null;
  return {
    userId: user.userId,
    managerLeagues: createSupabaseManagerLeagueRepository(await getSessionClient()),
  };
}

/** For a Manager page: a player who does not see the Manager gets the 404 page. */
export async function managerPorts(back: string) {
  return (await managerAccess(back)) ?? notFound();
}
