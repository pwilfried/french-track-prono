import type { ManagerFamily } from "./manager-rules";
import type { ManagerCompetitionScore, ScoringLineup } from "./manager-score";

/**
 * The jokers of a Manager league (#1091, decision of the owner, 22 Nov 2026): a league gets the
 * active ones of the catalogue (game `manager`) when it is created; each player plays each one once
 * in the season, at most one per head-to-head, chosen with the lineup. Never on a bonus matchday.
 */
export const MANAGER_JOKERS = [
  "captain",
  "false_start",
  "extended_bench",
  "coaching",
  "home_advantage",
] as const;
export type ManagerJoker = (typeof MANAGER_JOKERS)[number];

export function isManagerJoker(value: unknown): value is ManagerJoker {
  return MANAGER_JOKERS.includes(value as ManagerJoker);
}

/**
 * A joker played on a matchday, with its target. `athleteId`: the captain (a starter), the athlete
 * of the opponent hit by the false start, the 9th starter of the extended bench, the athlete coached
 * in; null until chosen, and for the home advantage. `family` and `discipline`: where the 9th
 * starter or the coached athlete counts. `replacedId`: the starter the coaching takes out.
 */
export type ManagerJokerPlay = {
  kind: ManagerJoker;
  athleteId: string | null;
  family?: ManagerFamily | null;
  discipline?: string | null;
  replacedId?: string | null;
};

/**
 * The match sheet that counts once the jokers that change it are applied (#1091): the extended
 * bench adds a 9th starter, without substitute nor threshold; the coaching puts an athlete in the
 * place of a starter, in their discipline, the designated substitute kept and the threshold dropped
 * (it was in the unit of the other discipline). The athlete brought in leaves the bench if they were
 * on it; an athlete already a starter, or a play not finished, changes nothing.
 */
export function lineupWithJoker(
  lineup: ScoringLineup,
  play: ManagerJokerPlay | null,
): ScoringLineup {
  if (!play || (play.kind !== "extended_bench" && play.kind !== "coaching")) return lineup;
  const { athleteId, family, discipline } = play;
  if (!athleteId || !family || !discipline) return lineup;
  if (lineup.starters.some((s) => s.athleteId === athleteId)) return lineup;
  const bench = lineup.bench.filter((b) => b.athleteId !== athleteId);
  if (play.kind === "extended_bench") {
    const ninth = { athleteId, family, discipline, substituteId: null, threshold: null };
    return { starters: [...lineup.starters, ninth], bench };
  }
  const place = lineup.starters.findIndex((s) => s.athleteId === play.replacedId);
  if (place < 0) return lineup;
  const starters = lineup.starters.map((s, i) =>
    i === place
      ? { athleteId, family, discipline, substituteId: s.substituteId, threshold: null }
      : s,
  );
  return { starters, bench };
}

/**
 * What a joker did on a matchday, seen from one side: `by` the side itself (`me`) or its opponent.
 * `points`: what it changed in the total of the side that played it, or that suffered it for a false
 * start (negative); for the extended bench and the coaching, what the athlete brought (already in
 * the score). 0: the joker had no effect (captain replaced, false start on an athlete who did not
 * score, home advantage away).
 */
export type ManagerJokerEffect = {
  kind: ManagerJoker;
  by: "me" | "opponent";
  athleteId: string | null;
  points: number;
};

/** The total of a side once the jokers count, and how much they changed it. */
export type ManagerJokerOutcome = {
  total: number;
  /** Added to the Manager score of the matchday (negative after a false start). */
  jokers: number;
  effects: ManagerJokerEffect[];
};

type Side = { score: ManagerCompetitionScore; play: ManagerJokerPlay | null };

function lineOf(score: ManagerCompetitionScore, athleteId: string | null) {
  return athleteId ? score.athletes.find((a) => a.athleteId === athleteId) : undefined;
}

/** The captain's extra points: the starter's own line once more, never their substitute's. */
function captainPoints(side: Side): number {
  if (side.play?.kind !== "captain") return 0;
  const own = lineOf(side.score, side.play.athleteId);
  return own && !own.substitution ? own.total : 0;
}

/**
 * The jokers of a head-to-head (#1091), on the Manager scores of both sides computed with
 * `lineupWithJoker`. In order: « Capitaine » doubles the line of a starter who counts (tables
 * divided + bonus); « Faux départ » halves, rounded down, the line of the athlete of the opponent
 * it hits, whoever they count for (starter, substitute who came in, 9th starter), captain doubling
 * included; « Avantage terrain » adds 5 % of the side's total so far, rounded down, at home only.
 * A side without a lineup scores 0 whatever the jokers.
 */
export function managerDuelJokers(
  home: Side,
  away: Side,
): { home: ManagerJokerOutcome; away: ManagerJokerOutcome } {
  const captains = { home: captainPoints(home), away: captainPoints(away) };

  /** What the false start of `attacker` takes from `target`, a negative number or 0. */
  const falseStart = (attacker: Side, target: Side, captain: number): number => {
    if (attacker.play?.kind !== "false_start") return 0;
    const hit = lineOf(target.score, attacker.play.athleteId);
    if (!hit) return 0;
    const doubled = target.play?.kind === "captain" && target.play.athleteId === hit.athleteId;
    const points = hit.total + (doubled ? captain : 0);
    return Math.floor(points / 2) - points;
  };
  const hits = {
    home: falseStart(away, home, captains.home),
    away: falseStart(home, away, captains.away),
  };

  const outcome = (side: Side, at: "home" | "away"): ManagerJokerOutcome => {
    const other = at === "home" ? away : home;
    const captain = captains[at];
    const hit = hits[at];
    const sofar = side.score.total + captain + hit;
    const advantage =
      side.play?.kind === "home_advantage" && at === "home" ? Math.floor(sofar / 20) : 0;
    const effects: ManagerJokerEffect[] = [];
    const play = side.play;
    if (play) {
      const athleteId = play.athleteId;
      const points =
        play.kind === "captain"
          ? captain
          : play.kind === "false_start"
            ? hits[at === "home" ? "away" : "home"]
            : play.kind === "home_advantage"
              ? advantage
              : (lineOf(side.score, athleteId)?.total ?? 0);
      effects.push({ kind: play.kind, by: "me", athleteId, points });
    }
    if (other.play?.kind === "false_start") {
      effects.push({
        kind: "false_start",
        by: "opponent",
        athleteId: other.play.athleteId,
        points: hit,
      });
    }
    if (!side.score.linedUp) return { total: 0, jokers: 0, effects };
    const jokers = captain + hit + advantage;
    return { total: side.score.total + jokers, jokers, effects };
  };

  return { home: outcome(home, "home"), away: outcome(away, "away") };
}

/** A joker played by a member of a Manager league, on the matchday of a competition. */
export type ManagerJokerUse = { kind: ManagerJoker; competitionId: string };

/** The jokers of a player in a Manager league: left, played, and the one of a matchday. */
export type ManagerJokerHand = {
  remaining: ManagerJoker[];
  used: ManagerJokerUse[];
  onMatchday: ManagerJoker | null;
};

export function managerJokerHand(
  leagueJokers: readonly ManagerJoker[],
  plays: readonly ManagerJokerUse[],
  competitionId?: string,
): ManagerJokerHand {
  const played = new Set(plays.map((p) => p.kind));
  return {
    remaining: MANAGER_JOKERS.filter((j) => leagueJokers.includes(j) && !played.has(j)),
    used: MANAGER_JOKERS.flatMap((j) => plays.filter((p) => p.kind === j)),
    onMatchday: plays.find((p) => p.competitionId === competitionId)?.kind ?? null,
  };
}
