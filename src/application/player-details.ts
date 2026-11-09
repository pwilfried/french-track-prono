import { isBannedName } from "@/domain/banned-names";
import { parseSex, pickDisciplines, validateClubName, type Sex } from "@/domain/player-details";

import type { Club, ClubDirectory } from "./clubs";
import type { DisciplineRepository } from "./disciplines";
import { UseCaseError, type ErrorCode } from "./errors";

/** What a player told about themselves (#340). Sex and disciplines stay private. */
export type PlayerDetails = { sex: Sex | null; disciplines: string[]; club: Club | null };

/** Port: the player's own details. Real adapter = Supabase, fake = in memory. */
export interface PlayerDetailsRepository {
  /** The signed-in player's details (empty when never filled). */
  find(userId: string): Promise<PlayerDetails>;
  save(
    userId: string,
    details: { sex: Sex | null; disciplines: string[]; clubId: string | null },
  ): Promise<"saved" | "unknown_club">;
}

export type PlayerDetailsInput = {
  sex: string;
  disciplines: string[];
  /** A club picked in the list, or "". */
  clubId: string;
  /** A club typed because it is not in the list (wins over clubId), or "". */
  newClubName: string;
  newClubCity: string;
};

/** The checks that need no database, to stop a sign-up before the profile is created. */
export function checkPlayerDetails(input: PlayerDetailsInput): ErrorCode | null {
  if (parseSex(input.sex) === "invalid") return "SEX_INVALID";
  if (input.newClubName.trim() !== "") {
    const name = validateClubName(input.newClubName);
    if (!name.ok) return name.code;
    if (input.newClubCity.trim().length > 80) return "CLUB_NAME_INVALID";
    if (isBannedName(input.newClubCity)) return "CLUB_NAME_BANNED";
  }
  return null;
}

export function savePlayerDetails(ports: {
  details: PlayerDetailsRepository;
  clubs: ClubDirectory;
  disciplines: DisciplineRepository;
}) {
  return {
    async execute(input: PlayerDetailsInput & { userId: string }): Promise<void> {
      const problem = checkPlayerDetails(input);
      if (problem) throw new UseCaseError(problem);
      const sex = parseSex(input.sex) as Sex | null;
      const known = (await ports.disciplines.list()).map((d) => d.name);
      const disciplines = pickDisciplines(input.disciplines, known);

      let clubId = input.clubId.trim() || null;
      if (input.newClubName.trim() !== "") {
        const name = validateClubName(input.newClubName);
        if (!name.ok) throw new UseCaseError(name.code);
        const proposed = await ports.clubs.propose(name.name, input.newClubCity.trim());
        if (proposed === "banned") throw new UseCaseError("CLUB_NAME_BANNED");
        clubId = proposed.id;
      }

      const outcome = await ports.details.save(input.userId, { sex, disciplines, clubId });
      if (outcome === "unknown_club") throw new UseCaseError("CLUB_UNKNOWN");
    },
  };
}

export function getPlayerDetails(ports: { details: PlayerDetailsRepository }) {
  return {
    execute: (input: { userId: string }): Promise<PlayerDetails> =>
      ports.details.find(input.userId),
  };
}
