import type { DisciplineFamily, MarkUnit } from "./discipline";
import { isInRange, markRange } from "./mark-range";
import {
  MANAGER_FAMILIES,
  managerFamilyOf,
  type ManagerFamily,
  type ManagerRules,
} from "./manager-rules";

/**
 * The lineup of a Manager team before an eligible competition (v0.14, #427), a match sheet since
 * #1032. The stadium holds `lineup.perFamily` places for each of the four Manager families
 * (#1017), in their order, and no free place. The starters fill every place their team can fill,
 * with athletes of the team entered in the competition, each once; at most `lineup.bench`
 * substitutes follow, in order; the rest of the team is the reserve. The same rule runs in SQL
 * (save_manager_lineup, supabase/migrations).
 */
export type LineupPlace = ManagerFamily;
export type LineupRules = Pick<ManagerRules["lineup"], "perFamily" | "bench">;

/** An athlete of the team, and whether they are entered in the competition. */
export type LineupAthlete = { athleteId: string; family: DisciplineFamily; entered: boolean };

/** A discipline an athlete may count in, with what its marks are read in. */
export type LineupDiscipline = { name: string; family: DisciplineFamily; unit: MarkUnit };

/**
 * An athlete of the team for the match sheet: their disciplines on a start list of the
 * competition (without any, those of their profile), the main one first.
 */
export type SheetAthlete = LineupAthlete & { disciplines: LineupDiscipline[] };

/**
 * A starter: the discipline that counts (the first one of the athlete when none is chosen), the
 * substitute designated for them on the bench, and the tactical threshold, a mark in the unit of
 * the discipline (seconds, metres or points) below which the substitute comes in.
 */
export type SheetStarter = {
  athleteId: string;
  discipline?: string;
  substituteId?: string | null;
  threshold?: number | null;
};
export type SheetSubstitute = { athleteId: string; discipline?: string };

/** Starters in place order, substitutes in the order they come in (rank 1 first). */
export type MatchSheet = { starters: SheetStarter[]; bench: SheetSubstitute[] };

export type LineupProblem =
  | "not_in_team"
  | "twice"
  | "absent"
  | "bench_full"
  | "does_not_fit"
  | "incomplete"
  | "discipline_not_entered"
  | "substitute_not_on_bench"
  | "substitute_other_family"
  | "substitute_twice"
  | "threshold_without_substitute"
  | "implausible_threshold";

/** Validated lineups can change until the lock: the first prediction lock of the competition. */
export type LineupStatus = "todo" | "validated" | "locked";

/** The places of the stadium: `perFamily` for each family, in the order of the families. */
export function lineupPlaces(rules: Pick<LineupRules, "perFamily">): LineupPlace[] {
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

/** The discipline that counts for an athlete: the one chosen, or their first; null when none fits. */
export function sheetDiscipline(
  athlete: Pick<SheetAthlete, "disciplines">,
  chosen: string | undefined,
): LineupDiscipline | null {
  if (chosen === undefined) return athlete.disciplines[0] ?? null;
  return athlete.disciplines.find((d) => d.name === chosen) ?? null;
}

/** Why the match sheet is not a lineup of the team, or null when it is one. */
export function lineupProblem(
  rules: LineupRules,
  team: SheetAthlete[],
  sheet: MatchSheet,
): LineupProblem | null {
  const byId = new Map(team.map((a) => [a.athleteId, a]));
  const starters = sheet.starters.map((s) => s.athleteId);
  const bench = sheet.bench.map((s) => s.athleteId);
  const chosen = [...starters, ...bench];
  if (chosen.some((id) => !byId.has(id))) return "not_in_team";
  if (new Set(chosen).size !== chosen.length) return "twice";
  if (chosen.some((id) => !byId.get(id)!.entered)) return "absent";
  if (bench.length > rules.bench) return "bench_full";
  const familyOf = (id: string) => managerFamilyOf(byId.get(id)!.family);
  if (bench.some((id) => familyOf(id) === null)) return "does_not_fit";
  const places = lineupPlaces(rules);
  if (placeLineup(places, team, starters).left.length > 0) return "does_not_fit";
  const fillable = fillablePlaces(places, team).filter(Boolean).length;
  if (starters.length < fillable) return "incomplete";

  const entries = [...sheet.starters, ...sheet.bench];
  if (entries.some((e) => !sheetDiscipline(byId.get(e.athleteId)!, e.discipline))) {
    return "discipline_not_entered";
  }
  const designated = sheet.starters.flatMap((s) => (s.substituteId == null ? [] : [s]));
  if (designated.some((s) => !bench.includes(s.substituteId!))) return "substitute_not_on_bench";
  if (designated.some((s) => familyOf(s.substituteId!) !== familyOf(s.athleteId))) {
    return "substitute_other_family";
  }
  if (new Set(designated.map((s) => s.substituteId)).size !== designated.length) {
    return "substitute_twice";
  }
  for (const s of sheet.starters) {
    if (s.threshold == null) continue;
    if (s.substituteId == null) return "threshold_without_substitute";
    const d = sheetDiscipline(byId.get(s.athleteId)!, s.discipline)!;
    if (!isInRange(s.threshold, markRange(d.unit, d.family, d.name))) {
      return "implausible_threshold";
    }
  }
  return null;
}

export function lineupStatus(
  competition: { lockAt: string; validated: boolean },
  now: string,
): LineupStatus {
  if (Date.parse(now) >= Date.parse(competition.lockAt)) return "locked";
  return competition.validated ? "validated" : "todo";
}
