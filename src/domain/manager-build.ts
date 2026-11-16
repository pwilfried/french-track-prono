import type { DisciplineFamily } from "./discipline";
import {
  MANAGER_SEXES,
  managerFamilyOf,
  type ManagerFamily,
  type ManagerRules,
  type ManagerSex,
} from "./manager-rules";

/** What « Mon équipe en construction » needs of the rules (#1037). */
export type BuildRules = Pick<ManagerRules, "minTeamSize" | "quotas">;

/** One athlete of the team under construction. */
export type BuildMember = { sex: ManagerSex; family: DisciplineFamily };

/** Where a family stands: what the team holds, what it needs, the sexes still missing. */
export type FamilyBuild = {
  family: ManagerFamily;
  have: number;
  /** The fewest athletes the family needs: its minimum, or a minimum of each sex. */
  need: number;
  /** How many athletes are still to recruit in it. */
  missing: number;
  /** The sexes under their minimum in the family. */
  missingSexes: ManagerSex[];
  done: boolean;
};

export type TeamBuild = {
  /** Athletes of the team that count (relays do not belong to a family). */
  count: number;
  /** The athletes to aim for: the minimum team. */
  target: number;
  /** How many are still to recruit to reach `target`. */
  missing: number;
  /** The credits left shared between the missing athletes, rounded down; null when none is missing. */
  perMissing: number | null;
  families: FamilyBuild[];
  /** Every family covered and the target reached. */
  complete: boolean;
};

/**
 * The team a player is building at the mercato (#1037): per family what is held and what is
 * missing, how many athletes to aim for, and what the credits left allow for each missing one.
 */
export function teamBuild(rules: BuildRules, team: BuildMember[], left: number): TeamBuild {
  const members = team.filter((a) => managerFamilyOf(a.family) !== null);
  const families = rules.quotas.map((q): FamilyBuild => {
    const own = members.filter((a) => managerFamilyOf(a.family) === q.family);
    const need = Math.max(q.min, q.minPerSex * 2);
    const missingSexes = MANAGER_SEXES.filter(
      (sex) => own.filter((a) => a.sex === sex).length < q.minPerSex,
    );
    const missing = Math.max(need - own.length, missingSexes.length);
    return {
      family: q.family,
      have: own.length,
      need,
      missing,
      missingSexes,
      done: missing === 0,
    };
  });
  const missing = Math.max(rules.minTeamSize - members.length, 0);
  return {
    count: members.length,
    target: rules.minTeamSize,
    missing,
    perMissing: missing === 0 ? null : Math.floor(Math.max(left, 0) / missing),
    families,
    complete: missing === 0 && families.every((f) => f.done),
  };
}

/** The steps of « Ton premier alignement » (#1037). */
export const FIRST_LINEUP_STEPS = ["starters", "bench", "tactical", "validate"] as const;
export type FirstLineupStep = (typeof FIRST_LINEUP_STEPS)[number];

export type FirstLineupInput = {
  startersFilled: number;
  /** The places the team can fill. */
  startersFillable: number;
  benchFilled: number;
  benchSize: number;
  tactical: boolean;
  validated: boolean;
};

/** Which steps are ticked, and the one the player is on (null once everything is done). */
export function firstLineupSteps(input: FirstLineupInput): {
  done: Record<FirstLineupStep, boolean>;
  current: FirstLineupStep | null;
} {
  const done: Record<FirstLineupStep, boolean> = {
    starters: input.startersFilled >= input.startersFillable && input.startersFillable > 0,
    bench: input.benchFilled >= input.benchSize,
    tactical: input.tactical,
    validate: input.validated,
  };
  // The tactical substitution is optional: it never holds the player back.
  const current = FIRST_LINEUP_STEPS.find((s) => !done[s] && s !== "tactical") ?? null;
  return { done, current };
}
