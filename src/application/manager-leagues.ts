import { isBannedName } from "@/domain/banned-names";
import type { Bib } from "@/domain/bib";
import { normalizeInviteCode, validateLeagueName } from "@/domain/league";
import {
  canLaunchMercato,
  countedCompetitions,
  isRoundHours,
  mercatoEndsAt,
  playersAwaited,
  seasonShape,
  type LeagueCompetition,
  type MercatoLaunch,
  type RoundMode,
} from "@/domain/manager-league";
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
  /** The players the league waits for, from its competitions (#644). */
  target: number;
};

export type ManagerParticipant = { userId: string; pseudo: string; bib: Bib };

/**
 * The mercato of a league, as its creator set it (#619): the players it waits for (from its
 * competitions, #644), when it opens
 * by itself (ISO, null: only when launched), when it opened, and whether its rounds follow French
 * Track rules. The durations themselves are in `rules.rounds`.
 */
export type ManagerMercato = {
  target: number;
  startsAt: string | null;
  openedAt: string | null;
  roundMode: RoundMode["mode"];
};

export type MercatoSettings = { startsAt: string | null; rounds: RoundMode };

/**
 * A league with the rules it copied at its creation, its competitions (first first) and its
 * participants (first joined first).
 */
export type ManagerLeagueFile = ManagerLeague & {
  rules: ManagerRules;
  mercato: ManagerMercato;
  competitions: LeagueCompetition[];
  participants: ManagerParticipant[];
};

/** A public league the player can still join. */
export type PublicManagerLeague = { id: string; name: string; memberCount: number; target: number };

export type JoinOutcome =
  | { outcome: "joined"; leagueId: string }
  | { outcome: "unknown" | "full" | "too_many" | "mercato_open" };

/** Port: the Manager leagues of the signed-in player. Real adapter = Supabase, fake = in memory. */
export interface ManagerLeagueRepository {
  /** With the competitions chosen; refused when one is not open to the Manager or is over. */
  create(
    name: string,
    isPublic: boolean,
    competitionIds: string[],
  ): Promise<{ id: string } | "banned" | "competitions_refused">;
  /** The competitions open to the Manager and not over yet, first first. */
  openCompetitions(): Promise<LeagueCompetition[]>;
  /** With a code; joining a league twice simply answers it. */
  join(code: string): Promise<JoinOutcome>;
  joinPublic(id: string): Promise<JoinOutcome>;
  listPublic(): Promise<PublicManagerLeague[]>;
  listMine(): Promise<ManagerLeague[]>;
  /** Null for a league the player is not in. */
  find(id: string): Promise<ManagerLeagueFile | null>;
  /** The creator only, while the mercato is not open. */
  setMercato(id: string, settings: MercatoSettings): Promise<"set" | "not_owner" | "mercato_open">;
  /**
   * The creator only, once the target is reached and enough competitions are left for the
   * season: round 1 opens.
   */
  launchMercato(
    id: string,
  ): Promise<"launched" | "not_owner" | "mercato_open" | "players_missing" | "competitions_short">;
}

type Ports = { managerLeagues: ManagerLeagueRepository };
type OwnerPorts = Ports & { userId: string };

/**
 * Any player creates a league and is its admin; every name is moderated, public or not. The
 * creator picks 6 competitions at least, not over yet: the number of players follows (#644).
 */
export function createManagerLeague(ports: Ports) {
  return {
    async execute(input: {
      name: string;
      isPublic: boolean;
      competitionIds: string[];
    }): Promise<{ id: string }> {
      const name = validateLeagueName(input.name);
      if (!name.ok) throw new UseCaseError(name.code);
      if (isBannedName(name.name)) throw new UseCaseError("LEAGUE_NAME_BANNED");
      const competitionIds = [...new Set(input.competitionIds)];
      if (!seasonShape(competitionIds.length)) {
        throw new UseCaseError("MANAGER_COMPETITIONS_TOO_FEW");
      }
      const created = await ports.managerLeagues.create(name.name, input.isPublic, competitionIds);
      if (created === "banned") throw new UseCaseError("LEAGUE_NAME_BANNED");
      if (created === "competitions_refused") {
        throw new UseCaseError("MANAGER_COMPETITIONS_INVALID");
      }
      return created;
    },
  };
}

/** The competitions a new league may be played on: open to the Manager, not over yet. */
export function listOpenManagerCompetitions(ports: Ports) {
  return { execute: () => ports.managerLeagues.openCompetitions() };
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

/** What the launch rules read of a league, the mercato opening at `now` (ISO). */
export const mercatoLaunch = (league: ManagerLeagueFile, now: string): MercatoLaunch => ({
  target: league.mercato.target,
  members: league.memberCount,
  openedAt: league.mercato.openedAt,
  startsAt: league.mercato.startsAt,
  counted: countedCompetitions(
    league.competitions,
    mercatoEndsAt(now, league.rules.rounds, league.rules.minTeamSize),
  ).length,
});

/** The league of the creator, its mercato not open yet. */
async function ownLeagueBeforeMercato(ports: OwnerPorts, id: string): Promise<ManagerLeagueFile> {
  const league = await ports.managerLeagues.find(id);
  if (!league) throw new UseCaseError("LEAGUE_NOT_FOUND");
  if (league.ownerId !== ports.userId) throw new UseCaseError("NOT_LEAGUE_OWNER");
  if (league.mercato.openedAt !== null) throw new UseCaseError("MERCATO_OPEN");
  return league;
}

function refused(outcome: "not_owner" | "mercato_open" | "players_missing" | "competitions_short") {
  if (outcome === "not_owner") return new UseCaseError("NOT_LEAGUE_OWNER");
  if (outcome === "mercato_open") return new UseCaseError("MERCATO_OPEN");
  if (outcome === "competitions_short") return new UseCaseError("MERCATO_COMPETITIONS_SHORT");
  return new UseCaseError("MERCATO_PLAYERS_MISSING");
}

/**
 * The creator sets the mercato (#619): when it opens by itself; rounds as French Track rules or
 * 12 to 72 hours. The number of players is no setting: it follows the competitions (#644).
 */
export function setManagerMercato(ports: OwnerPorts) {
  return {
    async execute(input: { id: string } & MercatoSettings): Promise<void> {
      await ownLeagueBeforeMercato(ports, input.id);
      const { rounds } = input;
      if (
        rounds.mode === "custom" &&
        !(isRoundHours(rounds.firstHours) && isRoundHours(rounds.nextHours))
      ) {
        throw new UseCaseError("MERCATO_ROUNDS_INVALID");
      }
      if (input.startsAt !== null && Number.isNaN(Date.parse(input.startsAt))) {
        throw new UseCaseError("DATE_INVALID");
      }
      const outcome = await ports.managerLeagues.setMercato(input.id, {
        startsAt: input.startsAt,
        rounds,
      });
      if (outcome !== "set") throw refused(outcome);
    },
  };
}

/**
 * The creator launches the mercato now (`now`, ISO), once every player it waits for is in and
 * enough competitions start 1 h after its expected end for the season: round 1 opens.
 */
export function launchManagerMercato(ports: OwnerPorts) {
  return {
    async execute(input: { id: string; now: string }): Promise<void> {
      const league = await ownLeagueBeforeMercato(ports, input.id);
      const launch = mercatoLaunch(league, input.now);
      if (!canLaunchMercato(launch, true)) {
        throw new UseCaseError(
          playersAwaited(launch) > 0 ? "MERCATO_PLAYERS_MISSING" : "MERCATO_COMPETITIONS_SHORT",
        );
      }
      const outcome = await ports.managerLeagues.launchMercato(input.id);
      if (outcome !== "launched") throw refused(outcome);
    },
  };
}
