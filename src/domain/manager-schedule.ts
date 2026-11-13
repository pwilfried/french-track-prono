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

/**
 * The competition of each matchday: the eligible competitions of the league, first one first,
 * one per matchday (#440). A competition beyond the last matchday has no head-to-head; a matchday
 * beyond the last competition has none (null) and is not played.
 */
export const matchdayCompetitions = (rounds: number, competitions: readonly string[]) =>
  Array.from({ length: rounds }, (_, i) => competitions[i] ?? null);
