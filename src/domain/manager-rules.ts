import type { DisciplineFamily } from "./discipline";

/** French Track Manager teams are made of women and men (v0.12, #418). */
export type ManagerSex = "F" | "M";
export const MANAGER_SEXES: ManagerSex[] = ["F", "M"];

/**
 * The four families of French Track Manager, the same for the team and the stadium (#1017):
 * sprint (100 to 400 m, hurdles), distance (800 m to the marathon, steeplechase), jumps (all
 * four, combined events included) and throws. A Manager team recruits athletes, not relay teams.
 */
export type ManagerFamily = "sprint" | "distance" | "jumps" | "throws";

/** Every family, in the order the team page and the stadium show them. */
export const MANAGER_FAMILIES: ManagerFamily[] = ["sprint", "distance", "jumps", "throws"];

const FAMILY_OF: Record<DisciplineFamily, ManagerFamily | null> = {
  sprint: "sprint",
  hurdles: "sprint",
  middle: "distance",
  long: "distance",
  horizontal_jumps: "jumps",
  vertical_jumps: "jumps",
  combined: "jumps",
  throws: "throws",
  relay: null,
};

/** The Manager family of a discipline family; none for relays. Same mapping in SQL (private.manager_family). */
export function managerFamilyOf(family: DisciplineFamily): ManagerFamily | null {
  return FAMILY_OF[family];
}

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

/**
 * How many athletes of a family a team holds: at least `min` in all, and of each sex at least
 * `minPerSex`, at most `maxPerSex`.
 */
export type TeamQuota = {
  family: ManagerFamily;
  min: number;
  minPerSex: number;
  maxPerSex: number;
};

/**
 * The general rules of French Track Manager, set by the admin of French Track Prono. A league
 * copies them when it is created and keeps that copy (docs/decisions/french-track-manager.md).
 */
export type ManagerRules = {
  /** Virtual credits, the same for every participant. */
  budget: number;
  /**
   * The fewest athletes a team holds; there is no maximum, the budget decides (#607). The
   * complement at the close of the mercato fills a team up to it.
   */
  minTeamSize: number;
  /** One quota per family. */
  quotas: TeamQuota[];
  /**
   * Before each competition: `max` starters, `perFamily` places for each family (no free place),
   * and `bench` ordered substitutes; the rest of the team is in reserve.
   */
  lineup: { max: number; perFamily: number; bench: number };
  /** The World Athletics points of an athlete are divided by it, rounded down (#1017). */
  tablesDivisor: number;
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

/** The fewest athletes of a family a team needs: its minimum, or a minimum of each sex. */
const familyMinimum = (q: TeamQuota) => Math.max(q.min, q.minPerSex * 2);

const isQuota = (q: TeamQuota) =>
  MANAGER_FAMILIES.includes(q.family) &&
  isCount(q.min) &&
  isCount(q.minPerSex) &&
  isPositiveCount(q.maxPerSex) &&
  q.minPerSex <= q.maxPerSex &&
  q.min <= q.maxPerSex * 2;

/**
 * Rules a season can be played with: one quota per family, a team can be completed up to its
 * minimum within them,
 * the minimum team covers the starters and the bench, every family's minimum covers its places,
 * every duration and bonus makes sense, at least one way to close the mercato.
 */
export function isPlayableManagerRules(rules: ManagerRules): boolean {
  const { quotas, lineup, rounds, season } = rules;
  const minTeam = quotas.reduce((sum, q) => sum + familyMinimum(q), 0);
  const maxTeam = quotas.reduce((sum, q) => sum + q.maxPerSex * 2, 0);
  return (
    isPositiveCount(rules.budget) &&
    isPositiveCount(rules.minTeamSize) &&
    quotas.length === MANAGER_FAMILIES.length &&
    MANAGER_FAMILIES.every((f) => quotas.some((q) => q.family === f)) &&
    quotas.every(isQuota) &&
    minTeam <= rules.minTeamSize &&
    rules.minTeamSize <= maxTeam &&
    isPositiveCount(lineup.perFamily) &&
    lineup.max === lineup.perFamily * MANAGER_FAMILIES.length &&
    isCount(lineup.bench) &&
    lineup.max + lineup.bench <= rules.minTeamSize &&
    quotas.every((q) => familyMinimum(q) >= lineup.perFamily) &&
    isPositiveCount(rules.tablesDivisor) &&
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
