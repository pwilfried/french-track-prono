import type { Bib } from "@/domain/bib";
import type { PredictionScore } from "@/domain/event-result";
import type { Podium } from "@/domain/podium-draft";
import type { Reaction } from "@/domain/reveal";

import { UseCaseError } from "./errors";
import type { LeagueRepository } from "./leagues";
import { addedToLeague } from "./rankings";

/** A prediction as revealed after the lock, with the reactions it received. */
export type RevealedPrediction = {
  predictionId: string;
  userId: string;
  pseudo: string;
  bib: Bib;
  podium: Podium;
  reactions: { userId: string; reaction: Reaction }[];
  /** Its computed points, with their reasons and joker points (#1155); null before they are. */
  score: PredictionScore | null;
};

/** The revealed podiums of an event, all the players' or one league's, by pseudo. */
export type EventReveal = { predictions: RevealedPrediction[] };

/** Port: the predictions of an event as the signed-in player may see them. */
export interface RevealRepository {
  /** `locked: false` before the lock (then only the player's own prediction would be readable). */
  listForEvent(eventId: string): Promise<{ locked: boolean; predictions: RevealedPrediction[] }>;
}

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

const byPseudo = (a: RevealedPrediction, b: RevealedPrediction) =>
  a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" });

/**
 * Everyone's podium once the event is locked, optionally only the members of one of my leagues.
 * Unfiltered, the screen only shows stats of them (#1155): the list is a league's.
 * Ordered by pseudo so that every player sees the same list.
 */
export function listEventPredictions(ports: {
  reveal: RevealRepository;
  leagues: LeagueRepository;
}) {
  const membersOf = async (leagueId: string) => {
    const members = await ports.leagues.members(leagueId);
    if (!members) throw new UseCaseError("LEAGUE_NOT_FOUND");
    return members;
  };
  return {
    async execute(input: { eventId: string; leagueId?: string }): Promise<EventReveal> {
      const { locked, predictions } = await ports.reveal.listForEvent(input.eventId);
      if (!locked) throw new UseCaseError("EVENT_NOT_LOCKED");
      const sorted = [...predictions].sort(byPseudo);
      if (input.leagueId) {
        // Only the podiums their players added to the league (#1068).
        const counted = new Set(
          (await membersOf(input.leagueId))
            .filter((m) =>
              addedToLeague(m.countedEvents && new Set(m.countedEvents), input.eventId),
            )
            .map((m) => m.userId),
        );
        return { predictions: sorted.filter((p) => counted.has(p.userId)) };
      }
      return { predictions: sorted };
    },
  };
}
