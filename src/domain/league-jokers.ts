import {
  scorePrediction,
  type EventBets,
  type FlairContext,
  type OfficialLine,
  type ScoringPrediction,
  type ScoringRules,
} from "./scoring";

/**
 * League jokers (#1090, decision of the owner, 22 Nov 2026): a league gets the active jokers of its
 * game when it is created; each one is played once in the whole league, on one event, and counts in
 * the league's ranking only, never in the general one.
 */
export type JokerGame = "predictions" | "manager";

/** The jokers of the prediction leagues, in the order they are shown. */
export const PREDICTION_JOKERS = [
  "double",
  "all_or_nothing",
  "safety_net",
  "spy",
  "outsider",
] as const;
export type PredictionJoker = (typeof PREDICTION_JOKERS)[number];

export function isPredictionJoker(value: unknown): value is PredictionJoker {
  return PREDICTION_JOKERS.includes(value as PredictionJoker);
}

/** The points of one prediction with each joker played on it: computed with the general points. */
export type JokerPoints = Record<PredictionJoker, number>;

/**
 * What each joker would make of a prediction. « Double »: ×2. « Tout ou rien »: ×3 on a perfect
 * podium, 0 otherwise. « Filet »: an athlete on the podium at the wrong place counts as at the right
 * place (points and odds), the perfect podium bonus only for a true one. « Espion »: no effect on
 * the points. « Outsider »: the odds points of « autre athlète » are doubled.
 */
export function jokerPoints(
  prediction: ScoringPrediction,
  official: OfficialLine[],
  rules: ScoringRules,
  context: FlairContext,
  bets?: EventBets,
): JokerPoints {
  const plain = scorePrediction(prediction, official, rules, context, bets);
  const perfect = plain.reasons.some((r) => r.kind === "perfect_podium");
  return {
    double: plain.points * 2,
    all_or_nothing: perfect ? plain.points * 3 : 0,
    safety_net: scorePrediction(prediction, official, rules, context, bets, { netWrongPlace: true })
      .points,
    spy: plain.points,
    outsider: scorePrediction(prediction, official, rules, context, bets, { otherOddsFactor: 2 })
      .points,
  };
}

/**
 * The points a score line counts in a league where `joker` is played on it. A line computed before
 * the league jokers carries no joker points: it counts its general points.
 */
export function pointsWithJoker(
  line: { points: number; jokers?: Partial<JokerPoints> },
  joker: PredictionJoker | null | undefined,
): number {
  if (!joker) return line.points;
  return line.jokers?.[joker] ?? line.points;
}

/** A joker played by a member of a league, on one event. */
export type JokerPlay = { joker: PredictionJoker; eventId: string };

/** Where a member stands with the jokers of a league, seen from one event. */
export type JokerHand = {
  /** The jokers not played yet, in the order of the catalogue. */
  remaining: PredictionJoker[];
  /** The jokers played, with their event. */
  used: JokerPlay[];
  /** The joker played on this event, if any. */
  onEvent: PredictionJoker | null;
  /** True when the joker on this event can still be changed or removed (before the lock, not the spy). */
  canChange: boolean;
};

/**
 * The jokers of a member in a league: the ones left and the ones played. Before the lock, the joker
 * on an event can be changed for one left, or removed; the spy cannot: it is spent once seen.
 */
export function jokerHand(
  leagueJokers: readonly PredictionJoker[],
  plays: readonly JokerPlay[],
  event?: { id: string; open: boolean },
): JokerHand {
  const played = new Set(plays.map((p) => p.joker));
  const onEvent = event ? (plays.find((p) => p.eventId === event.id)?.joker ?? null) : null;
  return {
    remaining: PREDICTION_JOKERS.filter((j) => leagueJokers.includes(j) && !played.has(j)),
    used: PREDICTION_JOKERS.flatMap((j) => plays.filter((p) => p.joker === j)),
    onEvent,
    canChange: Boolean(event?.open) && onEvent !== "spy",
  };
}
