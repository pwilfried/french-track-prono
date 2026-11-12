import type { RoundRules } from "./manager-round";

/**
 * A French Track Manager league plays with an even number of players, 4 to 10, so that everyone
 * has an opponent on each matchday (#619). The creator picks that number, the target; the mercato
 * opens only once the target is reached. The database does the same in launch_manager_mercato()
 * and private.open_manager_mercatos().
 */
export const MANAGER_LEAGUE_MIN = 4;
export const MANAGER_LEAGUE_MAX = 10;

/** The round durations a creator may choose, in hours. */
export const ROUND_HOUR_CHOICES = [12, 24, 48, 72] as const;

export const isPlayerTarget = (n: number) =>
  Number.isInteger(n) && n >= MANAGER_LEAGUE_MIN && n <= MANAGER_LEAGUE_MAX && n % 2 === 0;

/** A target the creator may set: even, 4 to 10, never under the players already in. */
export const isAllowedTarget = (target: number, members: number) =>
  isPlayerTarget(target) && target >= members;

/** The targets the creator may pick, smallest first. */
export function playerTargets(members: number): number[] {
  const targets: number[] = [];
  for (let n = MANAGER_LEAGUE_MIN; n <= MANAGER_LEAGUE_MAX; n += 2) {
    if (isAllowedTarget(n, members)) targets.push(n);
  }
  return targets;
}

/** What the launch of a mercato reads: the target, the players in, and its times (ISO). */
export type MercatoLaunch = {
  target: number;
  members: number;
  openedAt: string | null;
  startsAt: string | null;
};

/** How many players the league still waits for. */
export const playersAwaited = (league: MercatoLaunch) =>
  Math.max(0, league.target - league.members);

/** The creator launches the mercato now, once the players are all in; only once. */
export const canLaunchMercato = (league: MercatoLaunch, isOwner: boolean) =>
  isOwner && league.openedAt === null && league.members === league.target;

/** At its chosen time, the mercato opens by itself if and only if the players are all in. */
export const opensAutomatically = (league: MercatoLaunch, now: string) =>
  league.openedAt === null &&
  league.startsAt !== null &&
  Date.parse(league.startsAt) <= Date.parse(now) &&
  league.members === league.target;

/** How long the rounds last: as French Track rules (set by its admin), or as the creator chose. */
export type RoundMode =
  { mode: "auto" } | { mode: "custom"; firstHours: number; nextHours: number };

export const isRoundHours = (h: number) => (ROUND_HOUR_CHOICES as readonly number[]).includes(h);

/** The rounds of a league: the French Track ones, or the first one then the next ones as chosen. */
export function mercatoRounds(mode: RoundMode, frenchTrack: RoundRules): RoundRules {
  if (mode.mode === "auto") return { ...frenchTrack };
  return { firstHours: mode.firstHours, longRounds: 1, nextHours: mode.nextHours };
}
