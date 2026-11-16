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
 * The revealed podiums shown first, and the ones folded by default, only on the unfiltered view:
 * the players outside all of my leagues (#949), and every podium past the first
 * {@link REVEAL_SHOWN} (#984).
 */
export type EventReveal = { predictions: RevealedPrediction[]; others: RevealedPrediction[] };

/** Port: the predictions of an event as the signed-in player may see them. */
export interface RevealRepository {
  /** `locked: false` before the lock (then only the player's own prediction would be readable). */
  listForEvent(eventId: string): Promise<{ locked: boolean; predictions: RevealedPrediction[] }>;
}

/** How many podiums the unfiltered view shows before folding the rest (#984). */
export const REVEAL_SHOWN = 20;

/** The `ligue` value of the « Tous les joueurs » view, now that it is not the default (#984). */
export const ALL_PLAYERS = "tous";

/**
 * The league whose podiums open the reveal: the one I chose, else my first league (#984);
 * `undefined` for all the players, chosen with {@link ALL_PLAYERS} or when I am in no league.
 */
export function revealFilter(requested: string | undefined, myLeagueIds: string[]) {
  if (requested === ALL_PLAYERS) return undefined;
  return requested ?? myLeagueIds[0];
}

/** Shows the first podiums of `first` then of `rest`, at most {@link REVEAL_SHOWN}; folds the others. */
const fold = (first: RevealedPrediction[], rest: RevealedPrediction[]): EventReveal => ({
  predictions: first.slice(0, REVEAL_SHOWN),
  others: [...first.slice(REVEAL_SHOWN), ...rest],
});

const byPseudo = (a: RevealedPrediction, b: RevealedPrediction) =>
  a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" });

/**
 * Everyone's podium once the event is locked, optionally only the members of one of my leagues.
 * Without a filter, the members of my leagues come first and the others are folded, as are the
 * podiums past the first {@link REVEAL_SHOWN}.
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
      if (myLeagueIds.length === 0) return fold(sorted, []);
      const friends = new Set((await Promise.all(myLeagueIds.map(memberIds))).flat());
      return fold(
        sorted.filter((p) => friends.has(p.userId)),
        sorted.filter((p) => !friends.has(p.userId)),
      );
    },
  };
}
