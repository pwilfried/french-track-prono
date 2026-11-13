import type { DisciplineFamily } from "./discipline";

/**
 * A family of events a league can be limited to (#613). The two kinds of jumps of the discipline
 * table make one family here, as the owner listed them.
 */
export type LeagueFamily =
  "sprint" | "hurdles" | "middle" | "long" | "jumps" | "throws" | "combined" | "relay";

/** Every family, in the order of the creation screen. */
export const LEAGUE_FAMILIES: LeagueFamily[] = [
  "sprint",
  "hurdles",
  "middle",
  "long",
  "jumps",
  "throws",
  "combined",
  "relay",
];

/**
 * A family of a league: `addedAt` is null for a family chosen at creation, which counts every
 * event; a family added later (ISO 8601) only counts the events that start after it.
 */
export type LeagueFamilyRule = { family: LeagueFamily; addedAt: string | null };

/** The league family of a discipline family. */
export function leagueFamilyOf(family: DisciplineFamily): LeagueFamily {
  return family === "horizontal_jumps" || family === "vertical_jumps" ? "jumps" : family;
}

/** True when an event that starts at `startsAt` would count for a family added at `now`. */
export function countsOnceAdded(startsAt: string, now: string): boolean {
  return Date.parse(startsAt) > Date.parse(now);
}

/**
 * True when an event counts in a league with these families: always on all events (no family);
 * otherwise only an event of one of its families, and, for a family added later, only an event
 * that had not started when it was added (decision of the owner, 13 Nov 2026).
 */
export function countsForFamilies(
  rules: LeagueFamilyRule[],
  event: { family?: DisciplineFamily; startsAt: string },
): boolean {
  if (rules.length === 0) return true;
  if (!event.family) return false;
  const rule = rules.find((r) => r.family === leagueFamilyOf(event.family!));
  if (!rule) return false;
  return rule.addedAt === null || countsOnceAdded(event.startsAt, rule.addedAt);
}

/** Families (or rules) in the order of the screen, whatever order they were stored in. */
export function inScreenOrder<T extends { family: LeagueFamily }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => LEAGUE_FAMILIES.indexOf(a.family) - LEAGUE_FAMILIES.indexOf(b.family),
  );
}

/** The families the creator can still add: none in a league on all events, none ever removed. */
export function addableFamilies(rules: LeagueFamilyRule[]): LeagueFamily[] {
  if (rules.length === 0) return [];
  return LEAGUE_FAMILIES.filter((f) => !rules.some((r) => r.family === f));
}

export type LeagueFamiliesResult =
  { ok: true; families: LeagueFamily[] } | { ok: false; code: "LEAGUE_FAMILY_INVALID" };

/** Families as sent by a form: known ones only, once each, in the order of the screen. */
export function validateLeagueFamilies(input: string[]): LeagueFamiliesResult {
  if (!input.every((f) => (LEAGUE_FAMILIES as string[]).includes(f))) {
    return { ok: false, code: "LEAGUE_FAMILY_INVALID" };
  }
  return { ok: true, families: LEAGUE_FAMILIES.filter((f) => input.includes(f)) };
}
