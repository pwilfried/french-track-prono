import { roundEndsAt, type RoundRules } from "./manager-round";

/**
 * A French Track Manager league plays a home-and-away championship (#644): with N players, each
 * meets the others twice, 2 × (N − 1) matchdays, one competition each. The creator chooses the
 * competitions (at least 6, none finished); the players follow, exactly: the largest even N from 4
 * to 10 whose home-and-away fits. The competitions left over, at the end, are bonus matchdays
 * (Manager points only, no duel). The database does the same in private.manager_player_count().
 */
export const MIN_SEASON_COMPETITIONS = 6;
/** The player counts a league can reach: 4 with the minimum of 6 competitions, 10 at most. */
export const MANAGER_LEAGUE_MIN = 4;
export const MANAGER_LEAGUE_MAX = 10;

/** The matchdays of a home-and-away championship of `players`. */
const duelDaysOf = (players: number) => 2 * (players - 1);

export type SeasonFormat = { players: number; duelDays: number; bonusDays: number };

/** The players and matchdays of `competitions`, or null under 6 competitions. */
export function seasonFormat(competitions: number): SeasonFormat | null {
  if (!Number.isInteger(competitions) || competitions < MIN_SEASON_COMPETITIONS) return null;
  const fitting = Math.floor(competitions / 2) + 1;
  const players = Math.min(MANAGER_LEAGUE_MAX, fitting - (fitting % 2));
  const duelDays = duelDaysOf(players);
  return { players, duelDays, bonusDays: competitions - duelDays };
}

/** Competitions the creator may keep: at least 6, never fewer players than already in. */
export const fitsMembers = (competitions: number, members: number) =>
  (seasonFormat(competitions)?.players ?? 0) >= members;

/** The round durations a creator may choose, in hours. */
export const ROUND_HOUR_CHOICES = [12, 24, 48, 72] as const;

/**
 * The rounds a mercato is planned to last: its planned end decides which competitions the season
 * can count before it opens (#644). The calendar of the league page shows them.
 */
export const PLANNED_ROUNDS = 3;

/** A competition counts only if the mercato ends at least 1 hour before its first event. */
const SEASON_MARGIN_MS = 3_600_000;

/** When a mercato opening at `start` ends, after its planned rounds (ISO). */
export const plannedMercatoEnd = (start: string, rounds: RoundRules) =>
  roundEndsAt(start, rounds, PLANNED_ROUNDS);

/** The competitions the season counts for a mercato ending at `mercatoEndsAt`, first one first. */
export function seasonCompetitions<C extends { firstEventAt: string }>(
  competitions: readonly C[],
  mercatoEndsAt: string,
): C[] {
  const end = Date.parse(mercatoEndsAt);
  return [...competitions]
    .filter((c) => Date.parse(c.firstEventAt) - end >= SEASON_MARGIN_MS)
    .sort((a, b) => Date.parse(a.firstEventAt) - Date.parse(b.firstEventAt));
}

/** The first competition the mercato misses, if any, and the one the season starts with. */
export function seasonStart<C extends { firstEventAt: string }>(
  competitions: readonly C[],
  mercatoEndsAt: string,
): { missed: C | null; first: C | null } {
  const counted = seasonCompetitions(competitions, mercatoEndsAt);
  const missed = [...competitions]
    .filter((c) => !counted.includes(c))
    .sort((a, b) => Date.parse(a.firstEventAt) - Date.parse(b.firstEventAt))[0];
  return { missed: missed ?? null, first: counted[0] ?? null };
}

/** Whether `counted` competitions hold the home-and-away of `players`. */
export const hasEnoughCompetitions = (players: number, counted: number) =>
  counted >= duelDaysOf(players);

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

/**
 * The participant who joined last, first joined first in the list: the catalogue before the
 * mercato says « X vient de rejoindre la ligue » (#620). Nobody while the creator is alone.
 */
export const newestArrival = <P>(participants: readonly P[]): P | null =>
  participants.length > 1 ? participants[participants.length - 1]! : null;

/**
 * How to land exactly (#663), under the picker: the competitions missing under 6, else the format,
 * how many more for 2 more players (none at the cap of 10) and how many to remove for a
 * home-and-away without bonus (the bonus matchdays, 0 when it fits exactly).
 */
export type SeasonAdvice =
  | { kind: "too-few"; missing: number }
  | {
      kind: "format";
      format: SeasonFormat;
      next: { players: number; missing: number } | null;
      trim: number;
    };

export function seasonAdvice(competitions: number): SeasonAdvice {
  const format = seasonFormat(competitions);
  if (!format) {
    return { kind: "too-few", missing: MIN_SEASON_COMPETITIONS - Math.max(0, competitions) };
  }
  const players = format.players + 2;
  const next =
    players > MANAGER_LEAGUE_MAX ? null : { players, missing: duelDaysOf(players) - competitions };
  return { kind: "format", format, next, trim: format.bonusDays };
}
