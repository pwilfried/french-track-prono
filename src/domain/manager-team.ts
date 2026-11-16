import type { DisciplineFamily } from "./discipline";
import {
  MANAGER_SEXES,
  managerFamilyOf,
  type ManagerFamily,
  type ManagerSex,
  type TeamQuota,
} from "./manager-rules";

/**
 * A participant's team once the mercato is over (v0.14, #426): fixed for the season. Its athletes
 * show as cards, grouped by Manager family (managerFamilyOf, src/domain/manager-rules.ts).
 */
type TeamMember = { sex: ManagerSex; family: DisciplineFamily };

const words = (name: string) => name.trim().split(/\s+/).filter(Boolean);

/** What the card shows instead of a photo: the first letters of the first and the last name. */
export function athleteInitials(name: string): string {
  const parts = words(name);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/** The first name and the initial of the last name: « Léa F. ». */
export function shortAthleteName(name: string): string {
  const parts = words(name);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

/** What a team misses of a quota: an athlete of a sex, or athletes of the family whatever their sex. */
export type UnmetQuota = { family: ManagerFamily; sex: ManagerSex | null };

const count = (team: TeamMember[], family: ManagerFamily, sex?: ManagerSex) =>
  team.filter((a) => managerFamilyOf(a.family) === family && (!sex || a.sex === sex)).length;

/**
 * The quotas whose minimum the team does not reach, in the order of the rules: for each family,
 * the sexes under `minPerSex`, then the family itself when it is under `min`.
 */
export function unmetQuotas(quotas: TeamQuota[], team: TeamMember[]): UnmetQuota[] {
  return quotas.flatMap((q) => [
    ...MANAGER_SEXES.filter((sex) => count(team, q.family, sex) < q.minPerSex).map((sex) => ({
      family: q.family,
      sex,
    })),
    ...(count(team, q.family) < q.min ? [{ family: q.family, sex: null }] : []),
  ]);
}

/**
 * Whether an athlete may join a team: their family has a quota and the team holds fewer than
 * `maxPerSex` athletes of their sex in it. The complement at the close of the mercato follows the
 * same rule (private.manager_complement_candidates).
 */
export function fitsQuotas(quotas: TeamQuota[], team: TeamMember[], athlete: TeamMember): boolean {
  const family = managerFamilyOf(athlete.family);
  const quota = quotas.find((q) => q.family === family);
  return !!quota && count(team, quota.family, athlete.sex) < quota.maxPerSex;
}
