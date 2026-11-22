// « Le saviez-vous ? » (#766): a short athletics fact at the top of the player's home. The admin
// keeps a bank of facts; some are tied to a competition, a discipline or a date range and come
// first on those days. Facts about the game itself are computed from the real scale, never typed.
import { DEFAULT_RULES, scorePrediction, type ScoringRules } from "./scoring";

export const FUN_FACT_TAGS = ["predictions", "oddity", "bar"] as const;
/** « Pour tes pronos », « Insolite », « Pour briller au bar ». */
export type FunFactTag = (typeof FUN_FACT_TAGS)[number];

export const FUN_FACT_TITLE_MAX_LENGTH = 60;
export const FUN_FACT_BODY_MAX_LENGTH = 280;
export const FUN_FACT_SOURCE_MAX_LENGTH = 300;

/** What a player reads: never the source, kept for the admin. */
export type FunFact = {
  id: string;
  title: string;
  body: string;
  tag: FunFactTag;
  /** Shown first while this competition runs (or within the dates, when set). */
  competitionSlug: string | null;
  /** Shown first on a day with an event of this discipline. */
  discipline: string | null;
  /** YYYY-MM-DD, both included. */
  startsOn: string | null;
  endsOn: string | null;
};

/** What the admin edits. */
export type FunFactDraft = Omit<FunFact, "id"> & { source: string; active: boolean };

export type FunFactError =
  "FUN_FACT_TEXT_INVALID" | "FUN_FACT_TAG_INVALID" | "FUN_FACT_DATES_INVALID";

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const bounded = (s: string, max: number) => s.length > 0 && s.length <= max;
const orNull = (s: string | null) => (s && s.trim() !== "" ? s.trim() : null);

/** The draft trimmed, or the first thing wrong with it. */
export function checkFunFact(draft: FunFactDraft): FunFactDraft | { error: FunFactError } {
  const title = draft.title.trim();
  const body = draft.body.trim();
  const source = draft.source.trim();
  if (
    !bounded(title, FUN_FACT_TITLE_MAX_LENGTH) ||
    !bounded(body, FUN_FACT_BODY_MAX_LENGTH) ||
    source.length > FUN_FACT_SOURCE_MAX_LENGTH
  ) {
    return { error: "FUN_FACT_TEXT_INVALID" };
  }
  if (!FUN_FACT_TAGS.includes(draft.tag)) return { error: "FUN_FACT_TAG_INVALID" };
  const startsOn = orNull(draft.startsOn);
  const endsOn = orNull(draft.endsOn);
  if (
    (startsOn !== null && !isDay(startsOn)) ||
    (endsOn !== null && !isDay(endsOn)) ||
    (startsOn !== null && endsOn !== null && endsOn < startsOn)
  ) {
    return { error: "FUN_FACT_DATES_INVALID" };
  }
  return {
    ...draft,
    title,
    body,
    source,
    startsOn,
    endsOn,
    competitionSlug: orNull(draft.competitionSlug),
    discipline: orNull(draft.discipline),
  };
}

/** What the day holds: the competitions with their dates, the disciplines with an event today. */
export type FunFactDay = {
  day: string;
  competitions: { slug: string; startsOn: string; endsOn: string }[];
  disciplines: string[];
};

/** True when a fact is tied to something and today is one of its days. */
export function isFeatured(fact: FunFact, today: FunFactDay): boolean {
  const { day } = today;
  if (!fact.competitionSlug && !fact.discipline && !fact.startsOn && !fact.endsOn) return false;
  if (fact.startsOn && day < fact.startsOn) return false;
  if (fact.endsOn && day > fact.endsOn) return false;
  if (fact.competitionSlug && !fact.startsOn && !fact.endsOn) {
    const c = today.competitions.find((c) => c.slug === fact.competitionSlug);
    if (!c || day < c.startsOn || day > c.endsOn) return false;
  }
  if (fact.discipline && !today.disciplines.includes(fact.discipline)) return false;
  return true;
}

/** Days since 1970-01-01: the bank turns by one fact a day. */
const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

function rotate<T>(list: T[], by: number): T[] {
  if (list.length === 0) return list;
  const start = ((by % list.length) + list.length) % list.length;
  return [...list.slice(start), ...list.slice(0, start)];
}

/**
 * The order the card shows the facts in: the facts of the day first, then the others, each group
 * starting one further every day. « Un autre » walks down this list.
 */
export function factsOfTheDay(facts: FunFact[], today: FunFactDay): FunFact[] {
  const n = dayNumber(today.day);
  const featured = facts.filter((f) => isFeatured(f, today));
  const others = facts.filter((f) => !isFeatured(f, today));
  return [...rotate(featured, n), ...rotate(others, n)];
}

/** True when the player closed the card today: it comes back the next day. */
export const closedToday = (closedOn: string | null, day: string) => closedOn === day;

/** The figures of the scale the facts about the game quote, worked out by scorePrediction. */
export type GameFigures = {
  exactSlot: number;
  wrongPlace: number;
  perfectPodium: number;
  markExact: number;
};

/** The scale read from `scoring_rules` (snake case keys), the defaults for a missing one. */
export function rulesFromScale(scale: Record<string, number>): ScoringRules {
  const pick = (key: string, fallback: number) => scale[key] ?? fallback;
  return {
    exactSlot: pick("exact_slot", DEFAULT_RULES.exactSlot),
    wrongPlace: pick("wrong_place", DEFAULT_RULES.wrongPlace),
    perfectPodium: pick("perfect_podium", DEFAULT_RULES.perfectPodium),
    flairBonus: pick("flair_bonus", DEFAULT_RULES.flairBonus),
    flairThreshold: pick("flair_threshold", DEFAULT_RULES.flairThreshold),
    flairMinPlayers: pick("flair_min_players", DEFAULT_RULES.flairMinPlayers),
    oddsExact: pick("odds_exact", DEFAULT_RULES.oddsExact),
    oddsOneOff: pick("odds_one_off", DEFAULT_RULES.oddsOneOff),
    oddsTwoOff: pick("odds_two_off", DEFAULT_RULES.oddsTwoOff),
    markExact: pick("mark_exact", DEFAULT_RULES.markExact),
    markNear: pick("mark_near", DEFAULT_RULES.markNear),
  };
}

const OFFICIAL = [
  { athleteId: "a", rank: 1, markValue: 10 },
  { athleteId: "b", rank: 2, markValue: 10.1 },
  { athleteId: "c", rank: 3, markValue: 10.2 },
];
const NO_FLAIR = { predictionCount: 0, winnerPicks: {} };
const points = (
  rules: ScoringRules,
  prediction: { first: string; second: string; third: string },
) => scorePrediction(prediction, OFFICIAL, rules, NO_FLAIR).points;

/** The points of a few podiums, scored by the real rules: they follow the admin's scale. */
export function gameFigures(rules: ScoringRules): GameFigures {
  const perfect = { first: "a", second: "b", third: "c" };
  const markOnly = scorePrediction(
    {
      first: "x",
      second: "y",
      third: "a",
      marks: { first: null, second: null, third: 10 },
    },
    OFFICIAL,
    rules,
    NO_FLAIR,
    { odds: null, tolerance: 0.01 },
  ).reasons.find((r) => r.kind === "mark");
  return {
    exactSlot: points(rules, { first: "a", second: "x", third: "y" }),
    wrongPlace: points(rules, { first: "b", second: "x", third: "y" }),
    perfectPodium: points(rules, perfect),
    markExact: markOnly?.kind === "mark" ? markOnly.points : 0,
  };
}
