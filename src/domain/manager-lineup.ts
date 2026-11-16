import type { DisciplineFamily } from "./discipline";
import {
  MANAGER_FAMILIES,
  managerFamilyOf,
  type ManagerFamily,
  type ManagerRules,
} from "./manager-rules";

/**
 * The lineup of a Manager team before an eligible competition (v0.14, #427). The stadium holds
 * `lineup.perFamily` places for each of the four Manager families (#1017), in their order, and no
 * free place. A lineup fills every place its team can fill, with athletes of the team entered in
 * the competition, each once. The same rule runs in SQL (save_manager_lineup, supabase/migrations).
 */
export type LineupPlace = ManagerFamily;
export type LineupRules = Pick<ManagerRules["lineup"], "perFamily">;

/** An athlete of the team, and whether they are entered in the competition. */
export type LineupAthlete = { athleteId: string; family: DisciplineFamily; entered: boolean };

export type LineupProblem = "not_in_team" | "twice" | "absent" | "does_not_fit" | "incomplete";

/** Validated lineups can change until the lock: the first prediction lock of the competition. */
export type LineupStatus = "todo" | "validated" | "locked";

/** The places of the stadium: `perFamily` for each family, in the order of the families. */
export function lineupPlaces(rules: LineupRules): LineupPlace[] {
  return MANAGER_FAMILIES.flatMap((f) => Array.from({ length: rules.perFamily }, () => f));
}

export function fitsPlace(place: LineupPlace, family: DisciplineFamily): boolean {
  return place === managerFamilyOf(family);
}

/** Seats the chosen athletes, in their order, on a place of their family. Who finds none is left out. */
export function placeLineup(
  places: LineupPlace[],
  team: LineupAthlete[],
  chosen: string[],
): { placed: (string | null)[]; left: string[] } {
  const family = new Map(team.map((a) => [a.athleteId, a.family]));
  const placed: (string | null)[] = places.map(() => null);
  const left: string[] = [];
  for (const id of chosen) {
    const f = family.get(id);
    const i = f ? places.findIndex((p, j) => placed[j] === null && fitsPlace(p, f)) : -1;
    if (i >= 0) placed[i] = id;
    else left.push(id);
  }
  return { placed, left };
}

/**
 * Seats an athlete on a place of the stadium, as the player picks them for it: whoever sat there
 * takes the place the athlete left (a swap: both are of the same family), or goes back to the
 * bench. An athlete who does not fit the place, or is not entered, changes nothing.
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
  const from = placed.indexOf(athleteId);
  const next = placed.map((id) => (id === athleteId ? null : id));
  if (from >= 0) next[from] = placed[at] ?? null;
  next[at] = athleteId;
  return next;
}

/** Which places the team can fill with its athletes entered in the competition. */
export function fillablePlaces(places: LineupPlace[], team: LineupAthlete[]): boolean[] {
  const entered = team.filter((a) => a.entered);
  const { placed } = placeLineup(
    places,
    entered,
    entered.map((a) => a.athleteId),
  );
  // Seating everybody fills as many places of each family as it has athletes: what is filled is
  // what can be. The places of a family are alike, so the first ones are the fillable ones.
  return placed.map((id) => id !== null);
}

/**
 * Where a lineup stands (#839): the places held by an athlete entered in the competition, the
 * places the team can still fill (by place, in stadium order), and the ones none of its entered
 * athletes can fill. It is ready to validate once every place it can fill is filled, and at least
 * one is: with no athlete entered, there is no lineup to validate.
 */
export type LineupProgress = {
  filled: number;
  toFill: { place: LineupPlace; count: number }[];
  unfillable: number;
  ready: boolean;
};

export function lineupProgress(
  places: LineupPlace[],
  team: LineupAthlete[],
  placed: (string | null)[],
): LineupProgress {
  const entered = new Set(team.filter((a) => a.entered).map((a) => a.athleteId));
  const fillable = fillablePlaces(places, team);
  const toFill = new Map<LineupPlace, number>();
  let filled = 0;
  let unfillable = 0;
  places.forEach((place, i) => {
    const id = placed[i];
    if (id && entered.has(id)) filled++;
    else if (fillable[i]) toFill.set(place, (toFill.get(place) ?? 0) + 1);
    else unfillable++;
  });
  return {
    filled,
    toFill: [...toFill].map(([place, count]) => ({ place, count })),
    unfillable,
    ready: filled > 0 && toFill.size === 0,
  };
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
