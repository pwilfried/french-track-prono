import { redirect } from "next/navigation";

import { listLeagueEvents } from "@/application/league-events";
import type { LeagueFamily, LeagueFamilyRule } from "@/domain/league-families";
import { createSupabaseLeagueRepository, createSupabaseRankingRepository } from "@/infra";

import { messages } from "../messages.fr";

import { getCurrentUser, getSessionClient } from "../session";
import { publicEventReader, publicDisciplines } from "../public-data";

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

/**
 * The finals of a league's competitions, ready for `LeagueEventList` (#613): whether each counts
 * in the league, or, with `adding`, whether it would count once that family is added now.
 */
export async function loadLeagueEvents(input: {
  competitionSlugs: string[];
  families: LeagueFamilyRule[];
  adding?: LeagueFamily;
}) {
  const events = await listLeagueEvents({
    events: publicEventReader(),
    disciplines: publicDisciplines(),
  }).execute({
    competitionSlugs: input.competitionSlugs,
    families: input.families,
    adding: input.adding ? { family: input.adding, now: new Date().toISOString() } : undefined,
  });
  return events.map((e) => ({
    id: e.id,
    slug: e.slug,
    name: messages.events.name(e.discipline, e.gender),
    startsAt: e.startsAt,
    counts: e.counts,
  }));
}
