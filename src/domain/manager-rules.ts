import { DISCIPLINE_FAMILIES, type DisciplineFamily } from "./discipline";

/** French Track Manager teams are made of women and men (v0.12, #418). */
export type ManagerSex = "F" | "M";
export const MANAGER_SEXES: ManagerSex[] = ["F", "M"];

/** A Manager team recruits athletes, not relay teams. */
export const MANAGER_FAMILIES = DISCIPLINE_FAMILIES.filter((f) => f !== "relay");

/** The ways a mercato may end; the league admin picks among those the rules allow. */
export type MercatoCloseMode = "budgets_spent" | "last_bidder" | "scheduled";
export const MERCATO_CLOSE_MODES: MercatoCloseMode[] = [
  "budgets_spent",
  "last_bidder",
  "scheduled",
];

/** The sporting bonuses, all cumulative. */
export const MANAGER_BONUSES = [
  "first",
  "second",
  "third",
  "personal_best",
  "season_best",
  "national_record",
  "area_record",
  "world_record",
] as const;
export type ManagerBonus = (typeof MANAGER_BONUSES)[number];

/** How many athletes of a sex and a family a team holds: at least `min`, at most `max`. */
export type TeamQuota = { sex: ManagerSex; family: DisciplineFamily; min: number; max: number };

/**
 * The general rules of French Track Manager, set by the admin of French Track Prono. A league
 * copies them when it is created and keeps that copy (docs/decisions/french-track-manager.md).
 */
export type ManagerRules = {
  /** Virtual credits, the same for every participant. */
  budget: number;
  teamSize: number;
  /** Families without a quota cannot be recruited. */
  quotas: TeamQuota[];
  /** Before each competition: at most `max` athletes, at least so many of some families. */
  lineup: { max: number; minPerFamily: Partial<Record<DisciplineFamily, number>> };
  /** The first `longRounds` bidding rounds last `firstHours`, the next ones `nextHours`. */
  rounds: { firstHours: number; longRounds: number; nextHours: number };
  closeModes: MercatoCloseMode[];
  bonuses: Record<ManagerBonus, number>;
  /** ISO dates (YYYY-MM-DD). */
  season: { startsOn: string; endsOn: string };
};

const isCount = (n: number) => Number.isInteger(n) && n >= 0;
const isPositiveCount = (n: number) => Number.isInteger(n) && n > 0;
const isDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/**
 * Rules a season can be played with: a team can be completed within its quotas, a lineup fits in
 * a team, every duration and bonus makes sense, at least one way to close the mercato.
 */
export function isPlayableManagerRules(rules: ManagerRules): boolean {
  const { quotas, lineup, rounds, season } = rules;
  const minTeam = quotas.reduce((sum, q) => sum + q.min, 0);
  const maxTeam = quotas.reduce((sum, q) => sum + q.max, 0);
  const lineupMins = Object.values(lineup.minPerFamily);
  const quotaKeys = new Set(quotas.map((q) => `${q.sex}:${q.family}`));
  return (
    isPositiveCount(rules.budget) &&
    isPositiveCount(rules.teamSize) &&
    quotaKeys.size === quotas.length &&
    quotas.every((q) => isCount(q.min) && isPositiveCount(q.max) && q.min <= q.max) &&
    minTeam <= rules.teamSize &&
    rules.teamSize <= maxTeam &&
    isPositiveCount(lineup.max) &&
    lineup.max <= rules.teamSize &&
    lineupMins.every(isCount) &&
    lineupMins.reduce((sum, n) => sum + n, 0) <= lineup.max &&
    isPositiveCount(rounds.firstHours) &&
    isCount(rounds.longRounds) &&
    isPositiveCount(rounds.nextHours) &&
    rules.closeModes.length > 0 &&
    rules.closeModes.every((m) => MERCATO_CLOSE_MODES.includes(m)) &&
    MANAGER_BONUSES.every((b) => Number.isFinite(rules.bonuses[b]) && rules.bonuses[b] >= 0) &&
    isDate(season.startsOn) &&
    isDate(season.endsOn) &&
    season.startsOn <= season.endsOn
  );
}
