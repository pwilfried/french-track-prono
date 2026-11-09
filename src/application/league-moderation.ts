import { isBannedName } from "@/domain/banned-names";
import { validateLeagueName } from "@/domain/league";

import { UseCaseError } from "./errors";

/** A league as the admin sees it in the back-office (#321, #383). */
export type AdminLeague = {
  id: string;
  name: string;
  emoji: string;
  isPublic: boolean;
  /** The creator's pseudo; null once their account is gone. */
  owner: string | null;
  /** ISO 8601. */
  createdAt: string;
  memberCount: number;
  reportCount: number;
  /** Names of the league's competitions, the first one first. */
  competitions: string[];
};

/** A member in the league's sheet, with their points in that league and their rank. */
export type AdminLeagueMember = {
  userId: string;
  pseudo: string;
  avatar: string;
  isOwner: boolean;
  /** ISO 8601. */
  joinedAt: string;
  points: number;
  rank: number;
};

/**
 * Port: the moderation of public leagues, by the admin. Real adapter = Supabase (the database
 * checks the admin and logs each action), fake = in memory.
 */
export interface LeagueModerationRepository {
  /** Every league, the newest first, with its reports. */
  list(): Promise<AdminLeague[] | "not_admin">;
  /** The members with their points in the league (events locked after joining) and rank. */
  members(leagueId: string): Promise<AdminLeagueMember[] | "not_admin">;
  /** The reports were unfounded: clears them. */
  dismissReports(leagueId: string): Promise<"done" | "not_admin" | "unknown">;
  /** The owner is never removed: they hand over, or the admin deletes the league. */
  removeMember(
    leagueId: string,
    userId: string,
  ): Promise<"done" | "not_admin" | "unknown" | "owner">;
  /** Renames a league and clears its reports. */
  rename(leagueId: string, name: string): Promise<"done" | "not_admin" | "unknown">;
  /** Deletes a league with its members. */
  remove(leagueId: string): Promise<"done" | "not_admin" | "unknown">;
}

type Ports = { moderation: LeagueModerationRepository };

export function listAdminLeagues(ports: Ports) {
  return {
    async execute(): Promise<AdminLeague[]> {
      const listed = await ports.moderation.list();
      if (listed === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return listed;
    },
  };
}

export function getLeagueMembers(ports: Ports) {
  return {
    async execute(input: { leagueId: string }): Promise<AdminLeagueMember[]> {
      const members = await ports.moderation.members(input.leagueId);
      if (members === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return members;
    },
  };
}

export function dismissLeagueReports(ports: Ports) {
  return {
    async execute(input: { leagueId: string }): Promise<void> {
      const outcome = await ports.moderation.dismissReports(input.leagueId);
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (outcome === "unknown") throw new UseCaseError("LEAGUE_NOT_FOUND");
    },
  };
}

export function removeLeagueMember(ports: Ports) {
  return {
    async execute(input: { leagueId: string; userId: string }): Promise<void> {
      const outcome = await ports.moderation.removeMember(input.leagueId, input.userId);
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (outcome === "unknown") throw new UseCaseError("LEAGUE_MEMBER_UNKNOWN");
      if (outcome === "owner") throw new UseCaseError("LEAGUE_OWNER_STAYS");
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
