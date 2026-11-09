/** A club needs this many players with points to be ranked (#386): one strong player is not a club. */
export const MIN_CLUB_PLAYERS = 3;

export type ClubRank = {
  clubId: string;
  name: string;
  /** Players of the club who have points in the ranking. */
  players: number;
  /** Their average points, rounded to one decimal. */
  average: number;
  rank: number;
};

/**
 * Club ranking (#386): the average points of each club's players. Clubs with fewer than
 * `minPlayers` players are left out. Equal averages share the rank (1, 2, 2, 4); the order the
 * players arrive in never matters.
 */
export function rankClubs(
  players: { clubId: string | null; club: string | null; points: number }[],
  minPlayers = MIN_CLUB_PLAYERS,
): ClubRank[] {
  const byClub = new Map<string, { name: string; players: number; points: number }>();
  for (const p of players) {
    if (!p.clubId || !p.club) continue;
    const club = byClub.get(p.clubId) ?? { name: p.club, players: 0, points: 0 };
    club.players += 1;
    club.points += p.points;
    byClub.set(p.clubId, club);
  }
  const sorted = [...byClub]
    .filter(([, c]) => c.players >= minPlayers)
    .map(([clubId, c]) => ({
      clubId,
      name: c.name,
      players: c.players,
      average: Math.round((c.points / c.players) * 10) / 10,
    }))
    .sort(
      (a, b) =>
        b.average - a.average ||
        a.name.localeCompare(b.name, "fr", { sensitivity: "base" }) ||
        (a.clubId < b.clubId ? -1 : 1),
    );
  return sorted.map((club) => ({
    ...club,
    rank: sorted.findIndex((other) => other.average === club.average) + 1,
  }));
}
