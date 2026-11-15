import type { Bib } from "@/domain/bib";
import type { Podium } from "@/domain/podium-draft";
import type { Reaction } from "@/domain/reveal";

import { UseCaseError } from "./errors";
import type { LeagueRepository } from "./leagues";

/** A prediction as revealed after the lock, with the reactions it received. */
export type RevealedPrediction = {
  predictionId: string;
  userId: string;
  pseudo: string;
  bib: Bib;
  podium: Podium;
  useJoker: boolean;
  reactions: { userId: string; reaction: Reaction }[];
  /** True when the computed points of this prediction include the "coup de flair". */
  flair: boolean;
};

/**
 * The revealed podiums shown first, and the ones folded by default (#949): the players outside
 * all of my leagues, only on the unfiltered view and only when I am in a league.
 */
export type EventReveal = { predictions: RevealedPrediction[]; others: RevealedPrediction[] };

/** Port: the predictions of an event as the signed-in player may see them. */
export interface RevealRepository {
  /** `locked: false` before the lock (then only the player's own prediction would be readable). */
  listForEvent(eventId: string): Promise<{ locked: boolean; predictions: RevealedPrediction[] }>;
}

const byPseudo = (a: RevealedPrediction, b: RevealedPrediction) =>
  a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" });

/**
 * Everyone's podium once the event is locked, optionally only the members of one of my leagues.
 * Without a filter, the members of my leagues come first and the others are folded.
 * Ordered by pseudo so that every player sees the same list.
 */
export function listEventPredictions(ports: {
  reveal: RevealRepository;
  leagues: LeagueRepository;
}) {
  const memberIds = async (leagueId: string) => {
    const members = await ports.leagues.members(leagueId);
    if (!members) throw new UseCaseError("LEAGUE_NOT_FOUND");
    return members.map((m) => m.userId);
  };
  return {
    async execute(input: {
      eventId: string;
      leagueId?: string;
      myLeagueIds?: string[];
    }): Promise<EventReveal> {
      const { locked, predictions } = await ports.reveal.listForEvent(input.eventId);
      if (!locked) throw new UseCaseError("EVENT_NOT_LOCKED");
      const sorted = [...predictions].sort(byPseudo);
      if (input.leagueId) {
        const ids = new Set(await memberIds(input.leagueId));
        return { predictions: sorted.filter((p) => ids.has(p.userId)), others: [] };
      }
      const myLeagueIds = input.myLeagueIds ?? [];
      if (myLeagueIds.length === 0) return { predictions: sorted, others: [] };
      const friends = new Set((await Promise.all(myLeagueIds.map(memberIds))).flat());
      return {
        predictions: sorted.filter((p) => friends.has(p.userId)),
        others: sorted.filter((p) => !friends.has(p.userId)),
      };
    },
  };
}
