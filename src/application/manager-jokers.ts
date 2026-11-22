import {
  isManagerJoker,
  managerJokerHand,
  type ManagerJoker,
  type ManagerJokerHand,
} from "@/domain/manager-jokers";

import { UseCaseError, type ErrorCode } from "./errors";

/**
 * A joker played in a Manager league (#1091): its matchday's competition and its target, as the
 * database stores it. `athleteId`: captain, athlete hit by the false start, 9th starter, athlete
 * coached in; `replacedId`: the starter the coaching took out; `coached`: the coaching is used.
 */
export type ManagerJokerPlayRow = {
  userId: string;
  competitionId: string;
  kind: ManagerJoker;
  athleteId: string | null;
  discipline: string | null;
  replacedId: string | null;
  coached: boolean;
};

/** Why playing, removing or using a joker did not happen, besides success. The database decides. */
export type ManagerJokerOutcome =
  | "done"
  | "locked"
  | "not_available"
  | "no_duel"
  | "away"
  | "bad_target"
  | "no_coaching"
  | "not_member";

/** The head-to-head of the player on a matchday, for the jokers: the targets of a false start. */
export type JokerDuel = {
  home: boolean;
  opponentId: string;
  /** The athletes of the opponent's team, names only. */
  opponentTeam: { athleteId: string; name: string }[];
};

/**
 * Port: the jokers of the Manager leagues (#1091). Real adapter = Supabase (the player's session:
 * the database shows the opponent's joker from the lock only); fake = in memory.
 */
export interface ManagerJokerRepository {
  /** The jokers the league received when it was created; none outside it. */
  leagueJokers(leagueId: string): Promise<string[]>;
  /** The jokers the signed-in player may see: theirs, and the others' once the lineup is locked. */
  plays(leagueId: string): Promise<ManagerJokerPlayRow[]>;
  /** The player's head-to-head on the competition; null on a bonus matchday or without one. */
  duel(leagueId: string, competitionId: string): Promise<JokerDuel | null | "not_member">;
  /** Plays a joker on the player's head-to-head of the competition; replaces the one on it. */
  play(
    leagueId: string,
    competitionId: string,
    kind: ManagerJoker,
    athleteId: string | null,
  ): Promise<ManagerJokerOutcome>;
  /** Takes back the joker of the matchday, before the lock. */
  remove(leagueId: string, competitionId: string): Promise<ManagerJokerOutcome>;
  /** « Coaching », after the lock: `inId` takes the place of the starter `outId`. */
  coach(
    leagueId: string,
    competitionId: string,
    outId: string,
    inId: string,
  ): Promise<ManagerJokerOutcome>;
}

const CODES: Record<Exclude<ManagerJokerOutcome, "done">, ErrorCode> = {
  locked: "LINEUP_LOCKED",
  not_available: "JOKER_NOT_AVAILABLE",
  no_duel: "MANAGER_JOKER_NO_DUEL",
  away: "MANAGER_JOKER_AWAY",
  bad_target: "MANAGER_JOKER_BAD_TARGET",
  no_coaching: "MANAGER_JOKER_NO_COACHING",
  not_member: "LEAGUE_NOT_FOUND",
};

const done = (outcome: ManagerJokerOutcome) => {
  if (outcome !== "done") throw new UseCaseError(CODES[outcome]);
};

/** The jokers of a player on a matchday: the hand, theirs on it, and the opponent's once seen. */
export type MyManagerJokers = {
  /** The head-to-head of the matchday; null on a bonus one: no joker there. */
  duel: JokerDuel | null;
  hand: ManagerJokerHand;
  /** The joker the player plays on the matchday, with its target. */
  mine: ManagerJokerPlayRow | null;
  /** The opponent's joker on the matchday: null before the lock, or without one. */
  opponent: ManagerJokerPlayRow | null;
};

export function getMyManagerJokers(ports: { jokers: ManagerJokerRepository; userId: string }) {
  return {
    async execute(input: { leagueId: string; competitionId: string }): Promise<MyManagerJokers> {
      const [duel, league, plays] = await Promise.all([
        ports.jokers.duel(input.leagueId, input.competitionId),
        ports.jokers.leagueJokers(input.leagueId),
        ports.jokers.plays(input.leagueId),
      ]);
      if (duel === "not_member") throw new UseCaseError("LEAGUE_NOT_FOUND");
      const own = plays.filter((p) => p.userId === ports.userId);
      const onMatchday = (userId: string | undefined) =>
        plays.find((p) => p.userId === userId && p.competitionId === input.competitionId) ?? null;
      return {
        duel,
        hand: managerJokerHand(league.filter(isManagerJoker), own, input.competitionId),
        mine: onMatchday(ports.userId),
        opponent: onMatchday(duel?.opponentId),
      };
    },
  };
}

/** Plays a joker with the lineup, or changes it, until the lock (#1091). */
export function playManagerJoker(ports: { jokers: ManagerJokerRepository }) {
  return {
    async execute(input: {
      leagueId: string;
      competitionId: string;
      kind: ManagerJoker;
      athleteId: string | null;
    }): Promise<void> {
      done(
        await ports.jokers.play(input.leagueId, input.competitionId, input.kind, input.athleteId),
      );
    },
  };
}

/** Takes back the joker of the matchday, until the lock. */
export function removeManagerJoker(ports: { jokers: ManagerJokerRepository }) {
  return {
    async execute(input: { leagueId: string; competitionId: string }): Promise<void> {
      done(await ports.jokers.remove(input.leagueId, input.competitionId));
    },
  };
}

/** « Coaching », after the lock, once, before the starter's event (#1091). */
export function coachManagerLineup(ports: { jokers: ManagerJokerRepository }) {
  return {
    async execute(input: {
      leagueId: string;
      competitionId: string;
      outId: string;
      inId: string;
    }): Promise<void> {
      done(await ports.jokers.coach(input.leagueId, input.competitionId, input.outId, input.inId));
    },
  };
}
