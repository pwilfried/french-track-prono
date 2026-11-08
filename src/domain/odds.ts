import type { Entry } from "./event";
import { OTHER_ATHLETE } from "./podium-draft";

/** The odds of an event: athletes proposed with a multiplier each, and one for any other athlete. */
export type EventOdds = { proposed: { athleteId: string; odds: number }[]; other: number };

const fine = (odds: number) => Number.isFinite(odds) && odds > 0 && odds < 10000;

/**
 * At least one athlete of the start list, as many as the admin wants, each once, every odds
 * positive, and odds for another athlete too.
 */
export function isValidOdds(odds: EventOdds, startList: string[]): boolean {
  const ids = odds.proposed.map((p) => p.athleteId);
  return (
    ids.length >= 1 &&
    new Set(ids).size === ids.length &&
    ids.every((id) => startList.includes(id)) &&
    odds.proposed.every((p) => fine(p.odds)) &&
    fine(odds.other)
  );
}

/** Odds typed by the admin ("2,5", "1.80"), to the hundredth; null when not a number. */
export function parseOdds(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100) / 100;
}

/**
 * The first line whose odds, as typed, cannot be read or are not positive: an athlete id, or
 * OTHER_ATHLETE for « autre athlète »; null when every line is fine.
 */
export function firstInvalidOdds(
  proposed: { athleteId: string; text: string }[],
  other: string,
): string | null {
  const wrong = (text: string) => {
    const odds = parseOdds(text);
    return odds === null || !fine(odds);
  };
  return proposed.find((p) => wrong(p.text))?.athleteId ?? (wrong(other) ? OTHER_ATHLETE : null);
}

/** An athlete the player can put on the podium, with the odds, PR and SB shown to help him. */
export type PickChoice = Entry & { odds: number | null; personalBest: string | null };

/**
 * With odds, the picker offers the proposed athletes (favourite first) and « autre athlète »
 * (`otherName`). The marks are the PR and SB in the event's discipline.
 */
export function pickChoices(
  entries: Entry[],
  odds: EventOdds,
  marks: Map<string, { pr: string | null; sb: string | null }>,
  otherName: string,
): PickChoice[] {
  const proposed = [...odds.proposed]
    .sort((a, b) => a.odds - b.odds)
    .flatMap(({ athleteId, odds: value }): PickChoice[] => {
      const entry = entries.find((e) => e.athleteId === athleteId);
      if (!entry) return [];
      const mark = marks.get(athleteId);
      return [
        {
          ...entry,
          seasonBest: mark?.sb ?? entry.seasonBest,
          odds: value,
          personalBest: mark?.pr ?? null,
        },
      ];
    });
  const other: PickChoice = {
    athleteId: OTHER_ATHLETE,
    slug: OTHER_ATHLETE,
    name: otherName,
    countryCode: "",
    seasonBest: null,
    odds: odds.other,
    personalBest: null,
  };
  return [...proposed, other];
}
