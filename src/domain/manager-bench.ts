import type { DisciplineFamily } from "./discipline";
import type { MatchSheet, SheetStarter } from "./manager-lineup";
import type { ManagerSex } from "./manager-rules";
import { managerTablePoints } from "./manager-score";
import { worldAthleticsPoints } from "./world-athletics-points";

/**
 * The bench of a match sheet as the lineup screen edits it (#1035): the substitutes in the order
 * they come in, and what each starter's place sheet sets (the discipline that counts, their
 * designated substitute, the tactical threshold). The rules themselves live in lineupProblem.
 */
export type StarterSetting = Omit<SheetStarter, "athleteId">;
export type BenchPlan = { bench: string[]; settings: Record<string, StarterSetting> };

/** What a substitute does: replace a starter below a mark, replace them if they do not run, or wait. */
export type BenchRole =
  | { kind: "threshold"; starterId: string; threshold: number }
  | { kind: "absent"; starterId: string }
  | { kind: "bench" };

/** A reservist goes to the end of the bench, if it has room. */
export function addToBench(plan: BenchPlan, athleteId: string, size: number): BenchPlan {
  if (plan.bench.includes(athleteId) || plan.bench.length >= size) return plan;
  return { ...plan, bench: [...plan.bench, athleteId] };
}

/** Starters no longer count on someone in that list: no substitute, no threshold. */
function undesignate(settings: BenchPlan["settings"], athleteId: string): BenchPlan["settings"] {
  return Object.fromEntries(
    Object.entries(settings).map(([id, s]) => [
      id,
      s.substituteId === athleteId ? { ...s, substituteId: null, threshold: null } : s,
    ]),
  );
}

/** A substitute back in reserve (or onto the stadium): whoever counted on them no longer does. */
export function removeFromBench(plan: BenchPlan, athleteId: string): BenchPlan {
  if (!plan.bench.includes(athleteId)) return plan;
  return {
    bench: plan.bench.filter((id) => id !== athleteId),
    settings: undesignate(plan.settings, athleteId),
  };
}

/** Moves the substitute at `from` to `to` in the order of entry. */
export function moveOnBench(plan: BenchPlan, from: number, to: number): BenchPlan {
  const { bench } = plan;
  if (from < 0 || from >= bench.length || to < 0 || to >= bench.length || from === to) return plan;
  const next = [...bench];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return { ...plan, bench: next };
}

/**
 * Designates a substitute for a starter (a reservist goes on the bench, if it has room), taken
 * away from any other starter; null designates nobody, and the threshold goes with it.
 */
export function designateSubstitute(
  plan: BenchPlan,
  starterId: string,
  substituteId: string | null,
  size: number,
): BenchPlan {
  const own = plan.settings[starterId] ?? {};
  if (substituteId === null) {
    return {
      ...plan,
      settings: { ...plan.settings, [starterId]: { ...own, substituteId: null, threshold: null } },
    };
  }
  const seated = addToBench(plan, substituteId, size);
  if (!seated.bench.includes(substituteId)) return plan;
  return {
    bench: seated.bench,
    settings: {
      ...undesignate(plan.settings, substituteId),
      [starterId]: { ...own, substituteId },
    },
  };
}

/** What a substitute does, given the starters on the stadium. */
export function benchRole(plan: BenchPlan, starters: string[], athleteId: string): BenchRole {
  const starterId = starters.find((id) => plan.settings[id]?.substituteId === athleteId);
  if (starterId === undefined) return { kind: "bench" };
  const threshold = plan.settings[starterId]!.threshold;
  return threshold == null
    ? { kind: "absent", starterId }
    : { kind: "threshold", starterId, threshold };
}

/** The setting of a starter as sent: a substitute only from the bench, a threshold only with one. */
function settingOf(plan: BenchPlan, athleteId: string): StarterSetting {
  const { discipline, substituteId, threshold } = plan.settings[athleteId] ?? {};
  const substitute =
    substituteId != null && plan.bench.includes(substituteId) ? substituteId : null;
  return {
    ...(discipline !== undefined && { discipline }),
    ...(substitute !== null && { substituteId: substitute }),
    ...(substitute !== null && threshold != null && { threshold }),
  };
}

/** The match sheet of the stadium (places in order, empty ones left out) and the bench. */
export function matchSheetOf(placed: (string | null)[], plan: BenchPlan): MatchSheet {
  return {
    starters: placed
      .filter((id): id is string => id !== null)
      .map((athleteId) => ({ athleteId, ...settingOf(plan, athleteId) })),
    bench: plan.bench.map((athleteId) => ({ athleteId })),
  };
}

/** How many starters have a tactical replacement that will be sent. */
export function tacticalCount(starters: string[], plan: BenchPlan): number {
  return starters.filter((id) => settingOf(plan, id).threshold !== undefined).length;
}

/** How a mark falls short of the threshold: a race slower, a jump lower or shorter, a throw shorter. */
export type ThresholdSense = "slower" | "lower" | "shorter_jump" | "shorter_throw" | "fewer";

export function thresholdSense(family: DisciplineFamily): ThresholdSense {
  if (family === "vertical_jumps") return "lower";
  if (family === "horizontal_jumps") return "shorter_jump";
  if (family === "throws") return "shorter_throw";
  if (family === "combined") return "fewer";
  return "slower";
}

/** What a threshold mark is worth in the Manager (#1031), or null without a table for it. */
export function thresholdPoints(
  discipline: string,
  sex: ManagerSex,
  mark: number,
  divisor: number,
): number | null {
  const points = worldAthleticsPoints(discipline, sex, mark);
  return points === null ? null : managerTablePoints(points, divisor);
}
