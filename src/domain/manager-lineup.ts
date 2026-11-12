import type { DisciplineFamily } from "./discipline";
import type { ManagerRules } from "./manager-rules";
import { CARD_GROUPS, cardGroupOf, type CardGroup } from "./manager-team";

/**
 * The lineup of a Manager team before an eligible competition (v0.14, #427). The stadium holds
 * `lineup.max` places: so many per family, from the minimums of the rules (grouped as the cards
 * are), then free places that take any family. A lineup fills every place its team can fill, with
 * athletes of the team entered in the competition, each once. The same rule runs in SQL
 * (save_manager_lineup, supabase/migrations).
 */
export type LineupPlace = CardGroup | "free";
export type LineupRules = ManagerRules["lineup"];

/** An athlete of the team, and whether they are entered in the competition. */
export type LineupAthlete = { athleteId: string; family: DisciplineFamily; entered: boolean };

export type LineupProblem = "not_in_team" | "twice" | "absent" | "does_not_fit" | "incomplete";

/** Validated lineups can change until the lock: the first prediction lock of the competition. */
export type LineupStatus = "todo" | "validated" | "locked";

/** The places of the stadium: the family places in the order of the cards, then the free ones. */
export function lineupPlaces(rules: LineupRules): LineupPlace[] {
  const perGroup = new Map<CardGroup, number>();
  for (const [family, min] of Object.entries(rules.minPerFamily)) {
    const group = cardGroupOf(family as DisciplineFamily);
    perGroup.set(group, (perGroup.get(group) ?? 0) + (min ?? 0));
  }
  const places: LineupPlace[] = CARD_GROUPS.flatMap((g) =>
    Array.from({ length: perGroup.get(g) ?? 0 }, () => g),
  );
  const free = Math.max(0, rules.max - places.length);
  return [...places, ...Array.from({ length: free }, (): LineupPlace => "free")];
}

export function fitsPlace(place: LineupPlace, family: DisciplineFamily): boolean {
  return place === "free" || place === cardGroupOf(family);
}

/**
 * Seats the chosen athletes, in their order: on a place of their family first, then on a free
 * place. Who finds no place is left out. Seating the family places first fills the most places.
 */
export function placeLineup(
  places: LineupPlace[],
  team: LineupAthlete[],
  chosen: string[],
): { placed: (string | null)[]; left: string[] } {
  const family = new Map(team.map((a) => [a.athleteId, a.family]));
  const placed: (string | null)[] = places.map(() => null);
  const pending: string[] = [];
  for (const id of chosen) {
    const f = family.get(id);
    const i = f
      ? places.findIndex((p, j) => p !== "free" && placed[j] === null && fitsPlace(p, f))
      : -1;
    if (i >= 0) placed[i] = id;
    else pending.push(id);
  }
  const left: string[] = [];
  for (const id of pending) {
    const i = family.has(id) ? places.findIndex((p, j) => p === "free" && placed[j] === null) : -1;
    if (i >= 0) placed[i] = id;
    else left.push(id);
  }
  return { placed, left };
}

/**
 * Seats an athlete on a place of the stadium, as the player drops or taps them there: whoever sat
 * there goes back to the bench, then everybody is seated again family places first, so a family
 * place never stays empty while its athlete sits on a free one. An athlete who does not fit the
 * place, or is not entered, changes nothing.
 */
export function seatAthlete(
  places: LineupPlace[],
  team: LineupAthlete[],
  placed: (string | null)[],
  athleteId: string,
  at: number,
): (string | null)[] {
  const athlete = team.find((a) => a.athleteId === athleteId);
  const place = places[at];
  if (!athlete?.entered || place === undefined || !fitsPlace(place, athlete.family)) return placed;
  const next = placed.map((id) => (id === athleteId ? null : id));
  next[at] = athleteId;
  return placeLineup(
    places,
    team,
    next.filter((id): id is string => id !== null),
  ).placed;
}

/** Which places the team can fill with its athletes entered in the competition. */
export function fillablePlaces(places: LineupPlace[], team: LineupAthlete[]): boolean[] {
  const entered = team.filter((a) => a.entered);
  const { placed } = placeLineup(
    places,
    entered,
    entered.map((a) => a.athleteId),
  );
  // Seating everybody fills the family places first, then as many free places as are left:
  // what is filled is what can be. Free places are alike, so the first ones are the fillable ones.
  return placed.map((id) => id !== null);
}

/** Why the chosen athletes are not a lineup, or null when they are one. */
export function lineupProblem(
  rules: LineupRules,
  team: LineupAthlete[],
  chosen: string[],
): LineupProblem | null {
  const byId = new Map(team.map((a) => [a.athleteId, a]));
  if (chosen.some((id) => !byId.has(id))) return "not_in_team";
  if (new Set(chosen).size !== chosen.length) return "twice";
  if (chosen.some((id) => !byId.get(id)!.entered)) return "absent";
  const places = lineupPlaces(rules);
  if (placeLineup(places, team, chosen).left.length > 0) return "does_not_fit";
  const fillable = fillablePlaces(places, team).filter(Boolean).length;
  return chosen.length < fillable ? "incomplete" : null;
}

export function lineupStatus(
  competition: { lockAt: string; validated: boolean },
  now: string,
): LineupStatus {
  if (Date.parse(now) >= Date.parse(competition.lockAt)) return "locked";
  return competition.validated ? "validated" : "todo";
}
