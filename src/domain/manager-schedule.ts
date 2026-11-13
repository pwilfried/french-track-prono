/**
 * The championship of a French Track Manager league (v0.16, #432): each participant meets every
 * other one twice, once at home and once away. The schedule is drawn when the season starts (the
 * close of the mercato) and never changes. One eligible competition is one matchday (#440). The
 * database draws the same schedule in private.schedule_manager_season().
 */

/** One head-to-head of a matchday. */
export type Fixture = { home: string; away: string };

/** How many matchdays a home-and-away season of `players` participants lasts. */
export const seasonRounds = (players: number) => 2 * (players - 1);

/**
 * The matchdays of the season, first one first, for an even number of players (none otherwise).
 *
 * First leg: the circle method, the last player fixed, the others turning; on matchday r the
 * fixed player meets player r, and the k-th other pair meets players r + k and r − k (modulo
 * n − 1). Home and away alternate so that nobody plays three home or three away matchdays in a
 * row. Return leg: the same pairs with home and away swapped, starting from the second matchday
 * of the first leg (the first one comes last), so that the junction of the two legs keeps that
 * rule and nobody meets the same opponent twice in a row.
 */
export function seasonSchedule(players: readonly string[]): Fixture[][] {
  const n = players.length;
  if (n < 2 || n % 2 !== 0) return [];
  const m = n - 1;
  const p = (i: number) => players[i]!;
  const firstLeg: Fixture[][] = [];
  for (let r = 0; r < m; r++) {
    const round: Fixture[] = [
      r % 2 === 0 ? { home: p(r), away: p(m) } : { home: p(m), away: p(r) },
    ];
    for (let k = 1; k < n / 2; k++) {
      const a = p((r + k) % m);
      const b = p((r - k + m) % m);
      round.push(k % 2 === 1 ? { home: a, away: b } : { home: b, away: a });
    }
    firstLeg.push(round);
  }
  const returnLeg = [...firstLeg.slice(1), firstLeg[0]!].map((round) =>
    round.map(({ home, away }) => ({ home: away, away: home })),
  );
  return [...firstLeg, ...returnLeg];
}

/** A competition of the league, with the start of its first event (ISO). */
export type LeagueCompetition = { id: string; name: string; firstEventAt: string };

/** A competition counts only if its first event starts at least 1 h after the mercato closes. */
const SEASON_START_GAP_MS = 60 * 60 * 1000;

/**
 * The competitions of the season, first one first (first event, then name): those of the league
 * whose first event starts at least 1 h after the close of the mercato (owner's rule, 13 Nov.
 * 2026, #432).
 */
export const seasonCompetitions = (
  mercatoClosedAt: string,
  competitions: readonly LeagueCompetition[],
) =>
  competitions
    .filter((c) => Date.parse(c.firstEventAt) >= Date.parse(mercatoClosedAt) + SEASON_START_GAP_MS)
    .sort(
      (a, b) =>
        Date.parse(a.firstEventAt) - Date.parse(b.firstEventAt) || a.name.localeCompare(b.name),
    )
    .map((c) => c.id);

/** One matchday of the season: a head-to-head one, or a bonus one (Manager points only). */
export type Matchday = { round: number; competition: string | null; bonus: boolean };

/**
 * The matchdays of the season: one competition per matchday, first one first (#440). The first
 * `rounds` are head-to-head matchdays; a head-to-head matchday beyond the last competition has
 * none (null) and is not played. The competitions left after them are bonus matchdays: Manager
 * points only, no head-to-head, no championship points (owner's rule, 13 Nov. 2026).
 */
export function seasonMatchdays(rounds: number, competitions: readonly string[]): Matchday[] {
  const duels = Array.from({ length: rounds }, (_, i) => ({
    round: i + 1,
    competition: competitions[i] ?? null,
    bonus: false,
  }));
  const bonus = competitions
    .slice(rounds)
    .map((competition, i) => ({ round: rounds + i + 1, competition, bonus: true }));
  return [...duels, ...bonus];
}
