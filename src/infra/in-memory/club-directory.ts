import type { Club, ClubDirectory } from "@/application/clubs";
import { isBannedName } from "@/domain/banned-names";
import { matchesClub, searchKey } from "@/domain/club";

export type ClubFixture = Omit<Club, "id" | "validated"> & { validated?: boolean };

export type InMemoryClubDirectory = ClubDirectory & {
  add(club: ClubFixture): Club;
  /** The club if this player may pick it: validated, or typed by the player. */
  visible(id: string): Club | null;
};

/**
 * Test double of the ClubDirectory port, for one signed-in player. Same rules as search_clubs
 * and propose_club in the database.
 */
export function createInMemoryClubDirectory(fixtures: ClubFixture[] = []): InMemoryClubDirectory {
  const clubs: (Club & { mine: boolean })[] = [];
  const add = (club: ClubFixture, mine = false): Club => {
    const added = { id: crypto.randomUUID(), validated: true, ...club, mine };
    clubs.push(added);
    return strip(added);
  };
  const strip = (club: Club & { mine: boolean }): Club => ({
    id: club.id,
    name: club.name,
    city: club.city,
    department: club.department,
    validated: club.validated,
  });
  fixtures.forEach((club) => add(club));
  return {
    add,
    visible(id) {
      const club = clubs.find((c) => c.id === id && (c.validated || c.mine));
      return club ? strip(club) : null;
    },
    async search(query, limit) {
      const first = searchKey(query).split(" ")[0] ?? "";
      const starts = (club: Club) =>
        Number(searchKey(`${club.name} ${club.city}`).startsWith(first));
      return clubs
        .filter((club) => club.validated && matchesClub(query, club))
        .sort((a, b) => starts(b) - starts(a) || a.name.localeCompare(b.name, "fr"))
        .slice(0, limit)
        .map(strip);
    },
    async propose(name, city) {
      if (isBannedName(name) || isBannedName(city)) return "banned";
      const key = searchKey(`${name} ${city}`);
      const same = clubs
        .filter((c) => (c.validated || c.mine) && searchKey(`${c.name} ${c.city}`) === key)
        .sort((a, b) => Number(b.validated) - Number(a.validated))[0];
      if (same) return strip(same);
      return add({ name, city, department: "", validated: false }, true);
    },
  };
}
