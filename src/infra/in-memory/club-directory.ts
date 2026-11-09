import type { Club, ClubDirectory } from "@/application/clubs";
import { matchesClub, searchKey } from "@/domain/club";

export type ClubFixture = Omit<Club, "id" | "validated"> & { validated?: boolean };

/** Test double of the ClubDirectory port. Same rules as search_clubs in the database. */
export function createInMemoryClubDirectory(fixtures: ClubFixture[] = []): ClubDirectory & {
  add(club: ClubFixture): Club;
} {
  const clubs: Club[] = [];
  const add = (club: ClubFixture): Club => {
    const added = { id: crypto.randomUUID(), validated: true, ...club };
    clubs.push(added);
    return added;
  };
  fixtures.forEach(add);
  return {
    add,
    async search(query, limit) {
      const first = searchKey(query).split(" ")[0] ?? "";
      return clubs
        .filter((club) => club.validated && matchesClub(query, club))
        .sort(
          (a, b) =>
            Number(searchKey(`${b.name} ${b.city}`).startsWith(first)) -
              Number(searchKey(`${a.name} ${a.city}`).startsWith(first)) ||
            a.name.localeCompare(b.name, "fr"),
        )
        .slice(0, limit);
    },
  };
}
