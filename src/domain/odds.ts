import type { Entry } from "./event";
import { OTHER_ATHLETE } from "./podium-draft";

/** The odds of an event: athletes proposed with a multiplier each, and one for any other athlete. */
export type EventOdds = { proposed: { athleteId: string; odds: number }[]; other: number };

export const MIN_PROPOSED = 5;
export const MAX_PROPOSED = 6;

const fine = (odds: number) => Number.isFinite(odds) && odds > 1 && odds < 10000;

/** 5 or 6 different athletes of the start list, every odds above 1, odds for another athlete too. */
export function isValidOdds(odds: EventOdds, startList: string[]): boolean {
  const ids = odds.proposed.map((p) => p.athleteId);
  return (
    ids.length >= MIN_PROPOSED &&
    ids.length <= MAX_PROPOSED &&
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
