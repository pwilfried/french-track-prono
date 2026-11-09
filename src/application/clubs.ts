import { searchKey } from "@/domain/club";

/** An athletics club a player can pick (#339). */
export type Club = {
  id: string;
  name: string;
  city: string;
  department: string;
  /** False for a club a player typed, until the admin checks it. */
  validated: boolean;
};

/**
 * Port: the clubs directory. Real adapter = Supabase (search_clubs), fake = in memory.
 * Every word of the query must be found in the club's name or town, accents and case ignored.
 */
export interface ClubDirectory {
  search(query: string, limit: number): Promise<Club[]>;
}

/** Below this many letters the list would be too long to help. */
export const MIN_CLUB_QUERY = 2;

export function searchClubs(ports: { clubs: ClubDirectory }) {
  return {
    async execute(input: { query: string; limit?: number }): Promise<Club[]> {
      if (searchKey(input.query).replaceAll(" ", "").length < MIN_CLUB_QUERY) return [];
      return ports.clubs.search(input.query, Math.min(input.limit ?? 20, 50));
    },
  };
}
