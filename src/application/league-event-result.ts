import { rankByPoints } from "@/domain/event-result";
import { pointsWithJoker, type PredictionJoker } from "@/domain/league-jokers";

import { UseCaseError } from "./errors";
import type { LeagueJokerRepository } from "./league-jokers";
import type { LeagueMember, LeagueRepository } from "./leagues";
import { listEventPredictions, type RevealedPrediction, type RevealRepository } from "./reveal";

/**
 * A member's prediction in a league's result (#1155): its points there, the joker played on it
 * counted (#1090), and its rank; `points` and `rank` null while the points are not computed.
 */
export type LeagueResultLine = RevealedPrediction & {
  joker: PredictionJoker | null;
  points: number | null;
  rank: number | null;
};

/** The predictions of a league on an event, ranked by points, and the members without one. */
export type LeagueEventResult = { lines: LeagueResultLine[]; without: LeagueMember[] };

const byPseudo = (a: { pseudo: string }, b: { pseudo: string }) =>
  a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" });

/**
 * The predictions of one league ranked by their points in it: the joker played changes them, a
 * tie shares the rank and is ordered by pseudo. The ones not scored yet come last, by pseudo.
 */
export function rankLeaguePredictions(
  predictions: RevealedPrediction[],
  jokers: Map<string, PredictionJoker>,
): LeagueResultLine[] {
  const withJoker = predictions.map((p) => ({ ...p, joker: jokers.get(p.userId) ?? null }));
  const scored = withJoker.flatMap((p) =>
    p.score ? [{ ...p, points: pointsWithJoker(p.score, p.joker) }] : [],
  );
  const unscored = withJoker
    .filter((p) => !p.score)
    .sort(byPseudo)
    .map((p) => ({ ...p, points: null, rank: null }));
  return [...rankByPoints(scored, byPseudo), ...unscored];
}

/**
 * The result of an event inside a league (#1155): every member's prediction that counts in it,
 * ranked by points, then the members without one. Only after the lock, as the reveal.
 */
export function getLeagueEventResult(ports: {
  reveal: RevealRepository;
  leagues: LeagueRepository;
  jokers: Pick<LeagueJokerRepository, "plays">;
}) {
  return {
    async execute(input: { leagueId: string; eventId: string }): Promise<LeagueEventResult> {
      const [reveal, members, plays] = await Promise.all([
        listEventPredictions(ports).execute({ eventId: input.eventId, leagueId: input.leagueId }),
        ports.leagues.members(input.leagueId),
        ports.jokers.plays(input.leagueId),
      ]);
      if (!members) throw new UseCaseError("LEAGUE_NOT_FOUND");
      const jokers = new Map(
        plays.filter((p) => p.eventId === input.eventId).map((p) => [p.userId, p.joker] as const),
      );
      const lines = rankLeaguePredictions(reveal.predictions, jokers);
      const predicted = new Set(lines.map((l) => l.userId));
      return {
        lines,
        without: members.filter((m) => !predicted.has(m.userId)).sort(byPseudo),
      };
    },
  };
}
