import { roundEndsAt, type RoundRules } from "./manager-round";

/**
 * A French Track Manager season is home and away (#644): with N players, everyone meets the
 * others twice, 2 × (N − 1) matchdays, one competition each. The creator picks the competitions
 * not over yet (6 at least) when creating the league; the number of players follows from them,
 * the largest even number from 4 to 10 they hold. Competitions over that count are bonus
 * matchdays, at the end: Manager points only, no head-to-head. The mercato opens only once every
 * player is in. The database does the same in create_manager_league(),
 * launch_manager_mercato() and private.open_manager_mercatos().
 */
const MANAGER_LEAGUE_MIN = 4;
const MANAGER_LEAGUE_MAX = 10;

/** The fewest competitions a league is created with: a home-and-away season of 4 players. */
export const MANAGER_MIN_COMPETITIONS = 6;

/** A competition counts only if the mercato is over at least that long before it starts. */
const MERCATO_MARGIN_MS = 3_600_000;

/** The round durations a creator may choose, in hours. */
export const ROUND_HOUR_CHOICES = [12, 24, 48, 72] as const;

/** How many matchdays a home-and-away season of `players` takes. */
export const duelDays = (players: number) => 2 * (players - 1);

/** The season the chosen competitions make: its players, duel matchdays and bonus matchdays. */
export type SeasonShape = { players: number; duelDays: number; bonusDays: number };

/** Null under 6 competitions: not even a season of 4 players. */
export function seasonShape(competitions: number): SeasonShape | null {
  if (!Number.isInteger(competitions) || competitions < MANAGER_MIN_COMPETITIONS) return null;
  let players = MANAGER_LEAGUE_MIN;
  while (players < MANAGER_LEAGUE_MAX && duelDays(players + 2) <= competitions) players += 2;
  return { players, duelDays: duelDays(players), bonusDays: competitions - duelDays(players) };
}

/** A competition of a league, and when it starts (its first event, ISO). */
export type LeagueCompetition = { id: string; name: string; startsAt: string };

/**
 * When the mercato is expected to be over: after as many rounds as the smallest team holds
 * athletes (at least one), a round lasting as the league says.
 */
export const mercatoEndsAt = (startsAt: string, rounds: RoundRules, minTeamSize: number) =>
  roundEndsAt(startsAt, rounds, Math.max(1, minTeamSize));

/** The competitions that count, first first: they start at least 1 h after the mercato is over. */
export const countedCompetitions = (
  competitions: readonly LeagueCompetition[],
  mercatoEnd: string,
): LeagueCompetition[] =>
  competitions
    .filter((c) => Date.parse(c.startsAt) - Date.parse(mercatoEnd) >= MERCATO_MARGIN_MS)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

/** What the creator is told about the start of the season, for a mercato over at `mercatoEnd`. */
export type SeasonStart = {
  /** The first competition, when the mercato is over too late for it; null otherwise. */
  missed: LeagueCompetition | null;
  /** The competition the season then starts with; null when none is left. */
  first: LeagueCompetition | null;
  /** How many competitions the home-and-away season of the league still lacks. */
  short: number;
};

export function seasonStart(
  competitions: readonly LeagueCompetition[],
  target: number,
  mercatoEnd: string,
): SeasonStart {
  const counted = countedCompetitions(competitions, mercatoEnd);
  const earliest = countedCompetitions(competitions, new Date(0).toISOString())[0] ?? null;
  const first = counted[0] ?? null;
  return {
    missed: earliest && earliest.id !== first?.id ? earliest : null,
    first,
    short: Math.max(0, duelDays(target) - counted.length),
  };
}

/**
 * What the launch of a mercato reads: the target, the players in, its times (ISO), and how many
 * competitions would count if it opened now.
 */
export type MercatoLaunch = {
  target: number;
  members: number;
  openedAt: string | null;
  startsAt: string | null;
  counted: number;
};

/** How many players the league still waits for. */
export const playersAwaited = (league: MercatoLaunch) =>
  Math.max(0, league.target - league.members);

/** Enough competitions left for the home-and-away season of the league. */
const enoughCompetitions = (league: MercatoLaunch) => league.counted >= duelDays(league.target);

/**
 * The creator launches the mercato now, once the players are all in and enough competitions are
 * left for the season; only once.
 */
export const canLaunchMercato = (league: MercatoLaunch, isOwner: boolean) =>
  isOwner &&
  league.openedAt === null &&
  league.members === league.target &&
  enoughCompetitions(league);

/** At its chosen time, the mercato opens by itself if and only if it could be launched. */
export const opensAutomatically = (league: MercatoLaunch, now: string) =>
  league.startsAt !== null &&
  Date.parse(league.startsAt) <= Date.parse(now) &&
  canLaunchMercato(league, true);

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
