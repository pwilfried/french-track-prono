import { isBannedName } from "@/domain/banned-names";
import { validateLeagueName } from "@/domain/league";

import { UseCaseError } from "./errors";

/** A public league that players reported (#321). */
export type ReportedLeague = { id: string; name: string; reportCount: number; memberCount: number };

/**
 * Port: the moderation of public leagues, by the admin. Real adapter = Supabase (the database
 * checks the admin and logs each action), fake = in memory.
 */
export interface LeagueModerationRepository {
  /** The reported leagues, the most reported first. */
  listReported(): Promise<ReportedLeague[] | "not_admin">;
  /** Renames a league and clears its reports. */
  rename(leagueId: string, name: string): Promise<"done" | "not_admin" | "unknown">;
  /** Deletes a league with its members. */
  remove(leagueId: string): Promise<"done" | "not_admin" | "unknown">;
}

type Ports = { moderation: LeagueModerationRepository };

export function listReportedLeagues(ports: Ports) {
  return {
    async execute(): Promise<ReportedLeague[]> {
      const listed = await ports.moderation.listReported();
      if (listed === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return listed;
    },
  };
}

export function renameReportedLeague(ports: Ports) {
  return {
    async execute(input: { leagueId: string; name: string }): Promise<void> {
      const name = validateLeagueName(input.name);
      if (!name.ok) throw new UseCaseError(name.code);
      if (isBannedName(name.name)) throw new UseCaseError("LEAGUE_NAME_BANNED");
      const outcome = await ports.moderation.rename(input.leagueId, name.name);
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (outcome === "unknown") throw new UseCaseError("LEAGUE_NOT_FOUND");
    },
  };
}

export function deleteReportedLeague(ports: Ports) {
  return {
    async execute(input: { leagueId: string }): Promise<void> {
      const outcome = await ports.moderation.remove(input.leagueId);
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (outcome === "unknown") throw new UseCaseError("LEAGUE_NOT_FOUND");
    },
  };
}
