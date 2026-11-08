import { normalizeInviteCode, validateLeagueName } from "@/domain/league";

import { UseCaseError } from "./errors";

export type League = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  memberCount: number;
  /** The competitions whose points the league adds up. */
  competitionSlugs: string[];
};

export type LeagueMember = { userId: string; pseudo: string; avatar: string };

export type JoinOutcome =
  | { outcome: "joined"; leagueId: string }
  | { outcome: "already_member"; leagueId: string }
  | { outcome: "unknown_code" }
  | { outcome: "full" };

/**
 * Port: leagues, seen by the signed-in player (each method acts as them). Real adapter = Supabase
 * (the database functions check the rules), fake = in memory.
 */
export interface LeagueRepository {
  create(name: string, competitionSlugs: string[]): Promise<League>;
  join(code: string): Promise<JoinOutcome>;
  /** The leagues the player is a member of. */
  listMine(): Promise<League[]>;
  /** Null when the league does not exist or the player is not a member. */
  members(leagueId: string): Promise<LeagueMember[] | null>;
  leave(leagueId: string): Promise<"left" | "must_hand_over">;
  handOver(leagueId: string, newOwnerId: string): Promise<"done" | "not_owner" | "unknown_member">;
  /** Adds a coming competition to a league; only its creator may. */
  addCompetition(
    leagueId: string,
    competitionSlug: string,
  ): Promise<"added" | "not_owner" | "unknown" | "started">;
}

type Ports = { leagues: LeagueRepository };

export function createLeague(ports: Ports) {
  return {
    async execute(input: { name: string; competitionSlugs: string[] }): Promise<League> {
      const name = validateLeagueName(input.name);
      if (!name.ok) throw new UseCaseError(name.code);
      // A league may start without competition: its creator adds them afterwards (#312).
      return ports.leagues.create(name.name, [...new Set(input.competitionSlugs)]);
    },
  };
}

export function joinLeague(ports: Ports) {
  return {
    async execute(input: { code: string }): Promise<string> {
      const code = normalizeInviteCode(input.code);
      if (!code) throw new UseCaseError("LEAGUE_CODE_UNKNOWN");
      const joined = await ports.leagues.join(code);
      if (joined.outcome === "unknown_code") throw new UseCaseError("LEAGUE_CODE_UNKNOWN");
      if (joined.outcome === "full") throw new UseCaseError("LEAGUE_FULL");
      if (joined.outcome === "already_member") throw new UseCaseError("ALREADY_MEMBER");
      return joined.leagueId;
    },
  };
}

export function listMyLeagues(ports: Ports) {
  return {
    async execute(): Promise<League[]> {
      const leagues = await ports.leagues.listMine();
      return [...leagues].sort((a, b) =>
        a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
      );
    },
  };
}

export function getLeague(ports: Ports) {
  return {
    async execute(input: {
      leagueId: string;
    }): Promise<{ league: League; members: LeagueMember[] }> {
      const [mine, members] = await Promise.all([
        ports.leagues.listMine(),
        ports.leagues.members(input.leagueId),
      ]);
      const league = mine.find((l) => l.id === input.leagueId);
      if (!league || !members) throw new UseCaseError("LEAGUE_NOT_FOUND");
      return { league, members };
    },
  };
}

export function leaveLeague(ports: Ports) {
  return {
    async execute(input: { leagueId: string }): Promise<void> {
      const outcome = await ports.leagues.leave(input.leagueId);
      if (outcome === "must_hand_over") throw new UseCaseError("LEAGUE_OWNER_MUST_HAND_OVER");
    },
  };
}

export function handOverLeague(ports: Ports) {
  return {
    async execute(input: { leagueId: string; newOwnerId: string }): Promise<void> {
      const outcome = await ports.leagues.handOver(input.leagueId, input.newOwnerId);
      if (outcome === "not_owner") throw new UseCaseError("NOT_LEAGUE_OWNER");
      if (outcome === "unknown_member") throw new UseCaseError("LEAGUE_MEMBER_UNKNOWN");
    },
  };
}

export function addLeagueCompetition(ports: Ports) {
  return {
    async execute(input: { leagueId: string; competitionSlug: string }): Promise<void> {
      const outcome = await ports.leagues.addCompetition(input.leagueId, input.competitionSlug);
      if (outcome === "not_owner") throw new UseCaseError("NOT_LEAGUE_OWNER");
      if (outcome === "unknown") throw new UseCaseError("COMPETITION_NOT_FOUND");
      if (outcome === "started") throw new UseCaseError("COMPETITION_STARTED");
    },
  };
}
