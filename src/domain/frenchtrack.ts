import { utcToParis } from "./competition";
import type { EventGender } from "./event";
import type { Podium } from "./podium-draft";
import {
  scorePrediction,
  type EventBets,
  type FlairContext,
  type OfficialLine,
  type Score,
  type ScoringRules,
} from "./scoring";

/**
 * « Battez FrenchTrack » (#674): on the big finals, FrenchTrack posts its podium, hidden until the
 * lock, and each player sees whether they beat it. Only FrenchTrack runs the challenge.
 */

/** How a player did against FrenchTrack on one challenge. */
export type ChallengeVerdict = "won" | "lost" | "tie" | "no_prediction";

/**
 * FrenchTrack's points: its podium scored with the same scale as the players' (and the same field
 * for the « coup de flair »), never with a joker nor a mark.
 */
export function frenchTrackScore(
  podium: Podium,
  official: OfficialLine[],
  rules: ScoringRules,
  context: FlairContext,
  bets?: EventBets,
): Score {
  return scorePrediction({ ...podium, useJoker: false }, official, rules, context, bets);
}

/** The player's points on the event (null: no prediction) against FrenchTrack's. */
export function challengeVerdict(mine: number | null, frenchTrack: number): ChallengeVerdict {
  if (mine === null) return "no_prediction";
  return mine > frenchTrack ? "won" : mine < frenchTrack ? "lost" : "tie";
}

/** The players who scored strictly more than FrenchTrack, and their rounded share. */
export function beatShare(
  playerPoints: readonly number[],
  frenchTrack: number,
): { count: number; percent: number } {
  const count = playerPoints.filter((points) => points > frenchTrack).length;
  return {
    count,
    percent: playerPoints.length === 0 ? 0 : Math.round((count * 100) / playerPoints.length),
  };
}

/** One player's points on one scored challenge, with FrenchTrack's. */
export type ChallengeLine = {
  eventId: string;
  userId: string;
  pseudo: string;
  points: number;
  frenchTrackPoints: number;
};

export type ChallengeStanding = {
  userId: string;
  pseudo: string;
  wins: number;
  ties: number;
  /** Challenges the player predicted. */
  played: number;
  /** Points added up over the challenges played: they break a tie on wins. */
  points: number;
  rank: number;
};

const compare = (a: ChallengeStanding, b: ChallengeStanding) =>
  b.wins - a.wins || b.points - a.points;

/**
 * « Qui bat FrenchTrack le plus souvent ? »: challenges won, then points on the challenges
 * played. Players still equal share the place and are listed by pseudo; the order the lines
 * arrive in never changes anything.
 */
export function challengeSeason(lines: readonly ChallengeLine[]): ChallengeStanding[] {
  const byUser = new Map<string, ChallengeStanding>();
  for (const line of lines) {
    const standing = byUser.get(line.userId) ?? {
      userId: line.userId,
      pseudo: line.pseudo,
      wins: 0,
      ties: 0,
      played: 0,
      points: 0,
      rank: 0,
    };
    const verdict = challengeVerdict(line.points, line.frenchTrackPoints);
    standing.played += 1;
    standing.points += line.points;
    if (verdict === "won") standing.wins += 1;
    if (verdict === "tie") standing.ties += 1;
    byUser.set(line.userId, standing);
  }
  const sorted = [...byUser.values()].sort(
    (a, b) =>
      compare(a, b) ||
      a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }) ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );
  return sorted.map((standing, index) => {
    const first = sorted.findIndex((other) => compare(other, standing) === 0);
    return { ...standing, rank: first === index ? index + 1 : first + 1 };
  });
}

/**
 * The challenge the home shows: the open one that locks first, else the last one run; null
 * without any.
 */
export function featuredChallenge<T extends { eventId: string; lockAt: string; startsAt: string }>(
  challenges: readonly T[],
  now: Date,
): T | null {
  const time = now.getTime();
  const open = challenges
    .filter((c) => Date.parse(c.lockAt) > time)
    .sort((a, b) => Date.parse(a.lockAt) - Date.parse(b.lockAt));
  if (open[0]) return open[0];
  const past = [...challenges].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  return past[0] ?? null;
}

/**
 * « FrenchTrack battu par 42 % des joueurs sur le 100 m F » (#877): the moment of the community
 * block, once a challenge is computed. One per event, whatever the number of computations.
 */
export type ChallengeMoment = {
  key: string;
  eventId: string;
  slug: string;
  discipline: string;
  gender: EventGender;
  /** ISO 8601: when its points were first computed. */
  happenedAt: string;
  beaten: { count: number; percent: number };
  verdict: ChallengeVerdict;
};

/** The moments of the computed challenges, latest computed first; at most `limit`. */
export function challengeMoments(
  challenges: readonly {
    eventId: string;
    slug: string;
    discipline: string;
    gender: EventGender;
    scoredAt: string | null;
    points: number | null;
    mine: number | null;
    scores: readonly number[];
  }[],
  limit: number,
): ChallengeMoment[] {
  return challenges
    .flatMap((c) =>
      c.points === null || c.scoredAt === null
        ? []
        : [
            {
              key: `frenchtrack:${c.eventId}`,
              eventId: c.eventId,
              slug: c.slug,
              discipline: c.discipline,
              gender: c.gender,
              happenedAt: c.scoredAt,
              beaten: beatShare(c.scores, c.points),
              verdict: challengeVerdict(c.mine, c.points),
            },
          ],
    )
    .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt) || a.eventId.localeCompare(b.eventId))
    .slice(0, Math.max(0, limit));
}

/** The season of an instant: its calendar year, Paris time. */
export function challengeSeasonOf(instant: string): number {
  return Number(utcToParis(instant).slice(0, 4));
}
