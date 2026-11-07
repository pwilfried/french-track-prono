import type { Podium } from "@/domain/podium-draft";
import type { Reaction } from "@/domain/reveal";

import { UseCaseError } from "./errors";
import type { LeagueRepository } from "./leagues";

/** A prediction as revealed after the lock, with the reactions it received. */
export type RevealedPrediction = {
  predictionId: string;
  userId: string;
  pseudo: string;
  avatar: string;
  podium: Podium;
  useJoker: boolean;
  reactions: { userId: string; reaction: Reaction }[];
};

/** Port: the predictions of an event as the signed-in player may see them. */
export interface RevealRepository {
  /** `locked: false` before the lock (then only the player's own prediction would be readable). */
  listForEvent(eventId: string): Promise<{ locked: boolean; predictions: RevealedPrediction[] }>;
}

/**
 * Everyone's podium once the event is locked, optionally only the members of one of my leagues.
 * Ordered by pseudo so that every player sees the same list.
 */
export function listEventPredictions(ports: {
  reveal: RevealRepository;
  leagues: LeagueRepository;
}) {
  return {
    async execute(input: { eventId: string; leagueId?: string }): Promise<RevealedPrediction[]> {
      const { locked, predictions } = await ports.reveal.listForEvent(input.eventId);
      if (!locked) throw new UseCaseError("EVENT_NOT_LOCKED");
      let shown = predictions;
      if (input.leagueId) {
        const members = await ports.leagues.members(input.leagueId);
        if (!members) throw new UseCaseError("LEAGUE_NOT_FOUND");
        const ids = new Set(members.map((m) => m.userId));
        shown = predictions.filter((p) => ids.has(p.userId));
      }
      return [...shown].sort((a, b) =>
        a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }),
      );
    },
  };
}
