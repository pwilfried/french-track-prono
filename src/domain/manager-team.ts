import type { DisciplineFamily } from "./discipline";
import type { ManagerSex, TeamQuota } from "./manager-rules";

/**
 * A participant's team once the mercato is over (v0.14, #426): fixed for the season. Its athletes
 * show as cards, grouped as the team page groups them.
 */
export type CardGroup = "sprint" | "middle" | "long" | "jumps" | "throws" | "combined";

/** The groups of the team page, in order. */
export const CARD_GROUPS: CardGroup[] = ["sprint", "middle", "long", "jumps", "throws", "combined"];

/** Sprint and hurdles share a group, as do both kinds of jumps (no relay in a Manager team). */
export function cardGroupOf(family: DisciplineFamily): CardGroup {
  if (family === "hurdles" || family === "relay") return "sprint";
  if (family === "horizontal_jumps" || family === "vertical_jumps") return "jumps";
  return family;
}

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

/** The quotas whose minimum the team does not reach, in the order of the rules. */
export function unmetQuotas(
  quotas: TeamQuota[],
  team: { sex: ManagerSex; family: DisciplineFamily }[],
): { sex: ManagerSex; family: DisciplineFamily }[] {
  return quotas
    .filter((q) => team.filter((a) => a.sex === q.sex && a.family === q.family).length < q.min)
    .map(({ sex, family }) => ({ sex, family }));
}
