import { isBannedName } from "@/domain/banned-names";
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
  /** Joined in one tap without a code, up to 200 players (#277). */
  isPublic: boolean;
};

/** A public league as listed for players who may join it. */
export type PublicLeague = {
  id: string;
  name: string;
  memberCount: number;
  competitionSlugs: string[];
};

export type LeagueMember = { userId: string; pseudo: string; avatar: string; club?: string | null };

export type JoinOutcome =
  | { outcome: "joined"; leagueId: string }
  | { outcome: "already_member"; leagueId: string }
  | { outcome: "unknown_code" }
  | { outcome: "full" }
  /** Too many wrong codes lately: joining with a code waits an hour (#155). */
  | { outcome: "too_many" };

/**
 * Port: leagues, seen by the signed-in player (each method acts as them). Real adapter = Supabase
 * (the database functions check the rules), fake = in memory.
 */
export interface LeagueRepository {
  create(name: string, competitionSlugs: string[], isPublic: boolean): Promise<League>;
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
  /** Every public league. */
  listPublic(): Promise<PublicLeague[]>;
  /** Joins a public league without its code; "unknown_code" when it is not a public league. */
  joinPublic(leagueId: string): Promise<JoinOutcome>;
  /** Reports a public league to the admin (once per player). */
  report(leagueId: string): Promise<"reported" | "unknown">;
}

type Ports = { leagues: LeagueRepository };

export function createLeague(ports: Ports) {
  return {
    async execute(input: {
      name: string;
      competitionSlugs: string[];
      isPublic?: boolean;
    }): Promise<League> {
      const name = validateLeagueName(input.name);
      if (!name.ok) throw new UseCaseError(name.code);
      const isPublic = input.isPublic ?? false;
      // Everyone sees a public league: its name is moderated (#277).
      if (isPublic && isBannedName(name.name)) throw new UseCaseError("LEAGUE_NAME_BANNED");
      // A league may start without competition: its creator adds them afterwards (#312).
      return ports.leagues.create(name.name, [...new Set(input.competitionSlugs)], isPublic);
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
      if (joined.outcome === "too_many") throw new UseCaseError("LEAGUE_TOO_MANY_ATTEMPTS");
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

/** The public leagues the player is not in yet, the biggest first. */
export function listPublicLeagues(ports: Ports) {
  return {
    async execute(): Promise<PublicLeague[]> {
      const [all, mine] = await Promise.all([ports.leagues.listPublic(), ports.leagues.listMine()]);
      const joined = new Set(mine.map((l) => l.id));
      return all
        .filter((l) => !joined.has(l.id))
        .sort(
          (a, b) =>
            b.memberCount - a.memberCount ||
            a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
        );
    },
  };
}

/** Joins a public league in one tap; a player already in it is simply taken to it. */
export function joinPublicLeague(ports: Ports) {
  return {
    async execute(input: { leagueId: string }): Promise<string> {
      const joined = await ports.leagues.joinPublic(input.leagueId);
      if (joined.outcome === "unknown_code") throw new UseCaseError("LEAGUE_NOT_FOUND");
      if (joined.outcome === "full") throw new UseCaseError("LEAGUE_FULL");
      if (joined.outcome === "too_many") throw new UseCaseError("LEAGUE_TOO_MANY_ATTEMPTS");
      return joined.leagueId;
    },
  };
}

/** Reports a public league to the admin (#321); reporting twice changes nothing. */
export function reportLeague(ports: Ports) {
  return {
    async execute(input: { leagueId: string }): Promise<void> {
      const outcome = await ports.leagues.report(input.leagueId);
      if (outcome === "unknown") throw new UseCaseError("LEAGUE_NOT_FOUND");
    },
  };
}
