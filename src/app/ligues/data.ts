import { redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { listLeagueEvents } from "@/application/league-events";
import { getLeaguePredict } from "@/application/league-predict";
import type { LeagueFamily, LeagueFamilyRule } from "@/domain/league-families";
import {
  createSupabaseLeagueJokerRepository,
  createSupabaseLeagueMomentRepository,
  createSupabaseLeagueRepository,
  createSupabaseMomentReactionRepository,
  createSupabasePredictionRepository,
} from "@/infra";

import { messages } from "../messages.fr";

import { getCurrentUser, getSessionClient } from "../session";
import { publicEventReader, publicDisciplines, publicRanking } from "../public-data";

/** The signed-in player and the league ports acting as them; a visitor goes to the sign-in first. */
export async function leaguePorts(back: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(back)}`);
  const client = await getSessionClient();
  return {
    userId: user.userId,
    leagues: createSupabaseLeagueRepository(client),
    ranking: publicRanking(),
    // The jokers played count in the league rankings (#1090).
    jokers: createSupabaseLeagueJokerRepository(client),
    moments: createSupabaseLeagueMomentRepository(client),
    reactions: createSupabaseMomentReactionRepository(client),
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
  const now = Date.now();
  return events.map((e) => ({
    id: e.id,
    slug: e.slug,
    name: messages.events.name(e.discipline, e.gender),
    startsAt: e.startsAt,
    counts: e.counts,
    phase: e.winner
      ? ("finished" as const)
      : Date.parse(e.lockAt) <= now
        ? ("locked" as const)
        : ("upcoming" as const),
    winner: e.winner?.name ?? null,
  }));
}

/**
 * The « Pronostiquer » block of a league (#1069) for the signed-in player; null, so no block, when
 * it cannot be read.
 */
export async function loadLeaguePredict<C extends { slug: string; startsOn: string }>(input: {
  userId: string;
  competitionSlugs: string[];
  families: LeagueFamilyRule[];
  competitions: C[];
}) {
  try {
    return await getLeaguePredict({
      events: publicEventReader(),
      disciplines: publicDisciplines(),
      predictions: createSupabasePredictionRepository(await getSessionClient()),
    }).execute({ ...input, now: new Date() });
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}
