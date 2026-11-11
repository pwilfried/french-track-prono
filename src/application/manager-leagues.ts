import { isBannedName } from "@/domain/banned-names";
import { normalizeInviteCode, validateLeagueName } from "@/domain/league";
import type { ManagerRules } from "@/domain/manager-rules";

import { UseCaseError } from "./errors";

/** A French Track Manager league, as its participants see it. */
export type ManagerLeague = {
  id: string;
  name: string;
  isPublic: boolean;
  inviteCode: string;
  ownerId: string;
  memberCount: number;
};

export type ManagerParticipant = { userId: string; pseudo: string; avatar: string };

/** A league with the rules it copied at its creation and its participants, first joined first. */
export type ManagerLeagueFile = ManagerLeague & {
  rules: ManagerRules;
  competitionCount: number;
  participants: ManagerParticipant[];
};

/** A public league the player can still join. */
export type PublicManagerLeague = { id: string; name: string; memberCount: number };

export type JoinOutcome =
  | { outcome: "joined"; leagueId: string }
  | { outcome: "unknown" | "full" | "too_many" | "mercato_open" };

/** Port: the Manager leagues of the signed-in player. Real adapter = Supabase, fake = in memory. */
export interface ManagerLeagueRepository {
  create(name: string, isPublic: boolean): Promise<{ id: string } | "banned">;
  /** With a code; joining a league twice simply answers it. */
  join(code: string): Promise<JoinOutcome>;
  joinPublic(id: string): Promise<JoinOutcome>;
  listPublic(): Promise<PublicManagerLeague[]>;
  listMine(): Promise<ManagerLeague[]>;
  /** Null for a league the player is not in. */
  find(id: string): Promise<ManagerLeagueFile | null>;
}

type Ports = { managerLeagues: ManagerLeagueRepository };

/** Any player creates a league and is its admin; every name is moderated, public or not. */
export function createManagerLeague(ports: Ports) {
  return {
    async execute(input: { name: string; isPublic: boolean }): Promise<{ id: string }> {
      const name = validateLeagueName(input.name);
      if (!name.ok) throw new UseCaseError(name.code);
      if (isBannedName(name.name)) throw new UseCaseError("LEAGUE_NAME_BANNED");
      const created = await ports.managerLeagues.create(name.name, input.isPublic);
      if (created === "banned") throw new UseCaseError("LEAGUE_NAME_BANNED");
      return created;
    },
  };
}

export function listMyManagerLeagues(ports: Ports) {
  return {
    async execute(): Promise<ManagerLeague[]> {
      const leagues = await ports.managerLeagues.listMine();
      return [...leagues].sort((a, b) =>
        a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
      );
    },
  };
}

export function getManagerLeague(ports: Ports) {
  return {
    async execute(input: { id: string }): Promise<ManagerLeagueFile> {
      const league = await ports.managerLeagues.find(input.id);
      if (!league) throw new UseCaseError("LEAGUE_NOT_FOUND");
      return league;
    },
  };
}

function joined(result: JoinOutcome, unknown: "LEAGUE_CODE_UNKNOWN" | "LEAGUE_NOT_FOUND"): string {
  if (result.outcome === "joined") return result.leagueId;
  if (result.outcome === "full") throw new UseCaseError("LEAGUE_FULL");
  if (result.outcome === "too_many") throw new UseCaseError("LEAGUE_TOO_MANY_ATTEMPTS");
  if (result.outcome === "mercato_open") throw new UseCaseError("MERCATO_OPEN");
  throw new UseCaseError(unknown);
}

/** A private (or public) league joined with its code, until it is full or its mercato opens. */
export function joinManagerLeague(ports: Ports) {
  return {
    async execute(input: { code: string }): Promise<string> {
      const code = normalizeInviteCode(input.code);
      if (!code) throw new UseCaseError("LEAGUE_CODE_UNKNOWN");
      return joined(await ports.managerLeagues.join(code), "LEAGUE_CODE_UNKNOWN");
    },
  };
}

/** A public league joined in one tap while places are left. */
export function joinPublicManagerLeague(ports: Ports) {
  return {
    async execute(input: { id: string }): Promise<string> {
      return joined(await ports.managerLeagues.joinPublic(input.id), "LEAGUE_NOT_FOUND");
    },
  };
}

export function listPublicManagerLeagues(ports: Ports) {
  return { execute: () => ports.managerLeagues.listPublic() };
}
