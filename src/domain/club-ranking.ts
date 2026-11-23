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

/** A ranked club with its players, best first (#1132): the ranking tab unfolds them. */
export type RankedClub<T> = ClubRank & { members: T[] };

/**
 * Club ranking (#386): the average points of each club's players. Clubs with fewer than
 * `minPlayers` players are left out. Equal averages share the rank (1, 2, 2, 4); the order the
 * players arrive in never matters.
 */
export function rankClubs<T extends { clubId: string | null; club: string | null; points: number }>(
  players: T[],
  minPlayers = MIN_CLUB_PLAYERS,
): RankedClub<T>[] {
  const byClub = new Map<string, { name: string; players: number; points: number; members: T[] }>();
  for (const p of players) {
    if (!p.clubId || !p.club) continue;
    const club = byClub.get(p.clubId) ?? { name: p.club, players: 0, points: 0, members: [] };
    club.players += 1;
    club.points += p.points;
    club.members.push(p);
    byClub.set(p.clubId, club);
  }
  const sorted = [...byClub]
    .filter(([, c]) => c.players >= minPlayers)
    .map(([clubId, c]) => ({
      clubId,
      name: c.name,
      players: c.players,
      average: Math.round((c.points / c.players) * 10) / 10,
      members: [...c.members].sort((a, b) => b.points - a.points),
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
