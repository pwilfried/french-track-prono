/**
 * The championship of a French Track Manager league (v0.16, #433): on each head-to-head matchday
 * the higher Manager score wins, an equal score is a draw. Win 3 points, draw 1, defeat 0. The
 * standings rank on championship points, then wins, then the Manager points difference (scored
 * minus conceded), then the Manager points scored. A bonus matchday has no head-to-head and gives
 * no championship point (owner's rule, 13 Nov. 2026).
 */

export const CHAMPIONSHIP_POINTS = { win: 3, draw: 1, loss: 0 } as const;

export type DuelResult = "home" | "away" | "draw";

/** Who wins a head-to-head, from the two Manager scores of the competition. */
export const duelResult = (homeScore: number, awayScore: number): DuelResult =>
  homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw";

export type DuelOutcome = "win" | "draw" | "loss";

/** A head-to-head as one of its players sees it: won, drawn or lost, and the points it brings. */
export function duelOutcome(
  myScore: number,
  theirScore: number,
): { outcome: DuelOutcome; points: number } {
  const outcome: DuelOutcome =
    myScore > theirScore ? "win" : myScore === theirScore ? "draw" : "loss";
  return { outcome, points: CHAMPIONSHIP_POINTS[outcome] };
}

/** A head-to-head whose competition is scored. */
export type PlayedDuel = { home: string; away: string; homeScore: number; awayScore: number };

/** One line of the standings. */
export type StandingRow = {
  userId: string;
  /** Shared when points, wins, difference and points scored are all equal. */
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
  difference: number;
  points: number;
};

const blank = (userId: string): StandingRow => ({
  userId,
  rank: 1,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  scored: 0,
  conceded: 0,
  difference: 0,
  points: 0,
});

const TALLY = { win: "wins", draw: "draws", loss: "losses" } as const;

function record(row: StandingRow, scored: number, conceded: number) {
  row.played += 1;
  row.scored += scored;
  row.conceded += conceded;
  row.difference = row.scored - row.conceded;
  const { outcome, points } = duelOutcome(scored, conceded);
  row[TALLY[outcome]] += 1;
  row.points += points;
}

/** Positive when `a` ranks before `b`, 0 on a full tie. */
const compare = (a: StandingRow, b: StandingRow) =>
  b.points - a.points || b.wins - a.wins || b.difference - a.difference || b.scored - a.scored;

/**
 * The standings of the players, from the results of the head-to-heads played. Equal players keep
 * the order of `players` and share their rank.
 */
export function managerStandings(
  players: readonly string[],
  duels: readonly PlayedDuel[],
): StandingRow[] {
  const rows = new Map(players.map((p) => [p, blank(p)]));
  for (const d of duels) {
    const home = rows.get(d.home);
    const away = rows.get(d.away);
    if (home) record(home, d.homeScore, d.awayScore);
    if (away) record(away, d.awayScore, d.homeScore);
  }
  const sorted = [...rows.values()].sort(compare);
  sorted.forEach((row, i) => {
    const previous = sorted[i - 1];
    row.rank = previous && compare(previous, row) === 0 ? previous.rank : i + 1;
  });
  return sorted;
}

/** A matchday of the season: its competition (null: not played) and whether it is a bonus one. */
export type SeasonMatchday = { round: number; competitionId: string | null; bonus: boolean };
export type SeasonFixture = { round: number; home: string; away: string };
export type SeasonScore = { competitionId: string; userId: string; total: number };

/**
 * The head-to-heads played so far, first matchday first: those of a head-to-head matchday whose
 * competition has Manager scores. A missing score is 0 (no lineup). Never on a bonus matchday.
 */
export function seasonDuels(
  matchdays: readonly SeasonMatchday[],
  fixtures: readonly SeasonFixture[],
  scores: readonly SeasonScore[],
): (PlayedDuel & { round: number })[] {
  const totals = new Map(scores.map((s) => [`${s.competitionId}|${s.userId}`, s.total]));
  const scored = new Set(scores.map((s) => s.competitionId));
  const competitionOf = new Map(
    matchdays
      .filter((m) => !m.bonus && m.competitionId !== null && scored.has(m.competitionId))
      .map((m) => [m.round, m.competitionId!]),
  );
  return fixtures
    .filter((f) => competitionOf.has(f.round))
    .sort((a, b) => a.round - b.round)
    .map((f) => {
      const c = competitionOf.get(f.round)!;
      return {
        round: f.round,
        home: f.home,
        away: f.away,
        homeScore: totals.get(`${c}|${f.home}`) ?? 0,
        awayScore: totals.get(`${c}|${f.away}`) ?? 0,
      };
    });
}

export type MatchdayState = "played" | "upcoming" | "bonus" | "not_played";

/** `scored`: the competitions that have Manager scores in the league. */
export function matchdayState(m: SeasonMatchday, scored: ReadonlySet<string>): MatchdayState {
  if (m.bonus) return "bonus";
  if (m.competitionId === null) return "not_played";
  return scored.has(m.competitionId) ? "played" : "upcoming";
}

export type NextDuel = { round: number; competitionId: string; opponent: string; home: boolean };

/** The player's next head-to-head: the first one of an upcoming matchday; null when none is left. */
export function nextDuel(
  userId: string,
  matchdays: readonly SeasonMatchday[],
  fixtures: readonly SeasonFixture[],
  scored: ReadonlySet<string>,
): NextDuel | null {
  const upcoming = [...matchdays]
    .sort((a, b) => a.round - b.round)
    .filter((m) => matchdayState(m, scored) === "upcoming");
  for (const m of upcoming) {
    const f = fixtures.find((x) => x.round === m.round && (x.home === userId || x.away === userId));
    if (f) {
      const home = f.home === userId;
      return {
        round: m.round,
        competitionId: m.competitionId!,
        opponent: home ? f.away : f.home,
        home,
      };
    }
  }
  return null;
}
