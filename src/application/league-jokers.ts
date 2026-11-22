import { consensus, type Consensus } from "@/domain/consensus";
import {
  isPredictionJoker,
  jokerHand,
  type JokerGame,
  type JokerHand,
  type JokerPlay,
  type PredictionJoker,
} from "@/domain/league-jokers";

import type { ConsensusRepository } from "./consensus";
import { UseCaseError } from "./errors";

/** A joker of the catalogue: whether a new league of its game receives it. */
export type CatalogueJoker = { joker: string; active: boolean };

/** A joker played in a league, by one of its members. */
export type LeagueJokerPlay = JokerPlay & { userId: string };

/** Why playing or removing a joker did not happen, besides success. The database decides. */
export type JokerOutcome =
  "done" | "locked" | "not_available" | "spy_spent" | "not_in_league" | "not_member";

/**
 * Port: the league jokers (#1090). The catalogue of each game, the jokers each league received,
 * and the jokers played. Real adapter = Supabase (the player's session), fake = in memory.
 */
export interface LeagueJokerRepository {
  /** The jokers of a game, in their order, active or not. */
  catalogue(game: JokerGame): Promise<CatalogueJoker[]>;
  /** Turns a joker on or off for the leagues created from now on. */
  setActive(
    game: JokerGame,
    joker: string,
    active: boolean,
  ): Promise<"saved" | "not_admin" | "unknown">;
  /** The jokers a league received when it was created. */
  leagueJokers(leagueId: string): Promise<string[]>;
  /** The jokers played in a league that the signed-in player may see: theirs, and the others' once locked. */
  plays(leagueId: string): Promise<LeagueJokerPlay[]>;
  /** Plays a joker on the signed-in player's prediction of the event; replaces the one on it. */
  play(leagueId: string, eventId: string, joker: PredictionJoker): Promise<JokerOutcome>;
  /** Takes back the joker of the event, before the lock (never the spy). */
  remove(leagueId: string, eventId: string): Promise<JokerOutcome>;
}

const CODES = {
  locked: "JOKER_LOCKED",
  not_available: "JOKER_NOT_AVAILABLE",
  spy_spent: "JOKER_SPY_SPENT",
  not_in_league: "JOKER_NOT_IN_LEAGUE",
  not_member: "LEAGUE_NOT_FOUND",
} as const;

const known = (jokers: string[]) => jokers.filter(isPredictionJoker);

/** The catalogue of a game, as the back-office and the screen that creates a league show it. */
export function listJokerCatalogue(ports: { jokers: Pick<LeagueJokerRepository, "catalogue"> }) {
  return {
    async execute(input: { game: JokerGame }): Promise<CatalogueJoker[]> {
      return ports.jokers.catalogue(input.game);
    },
  };
}

/**
 * The jokers a new league of the game receives (#1090): the active ones of the catalogue, shown
 * read only on the screen that creates a league.
 */
export function listNewLeagueJokers(ports: { jokers: Pick<LeagueJokerRepository, "catalogue"> }) {
  return {
    async execute(input: { game: JokerGame }): Promise<string[]> {
      return (await ports.jokers.catalogue(input.game)).filter((j) => j.active).map((j) => j.joker);
    },
  };
}

/** The admin turns a joker on or off; the leagues already created keep theirs. */
export function setJokerActive(ports: { jokers: Pick<LeagueJokerRepository, "setActive"> }) {
  return {
    async execute(input: { game: JokerGame; joker: string; active: boolean }): Promise<void> {
      const outcome = await ports.jokers.setActive(input.game, input.joker, input.active);
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (outcome === "unknown") throw new UseCaseError("JOKERS_UNAVAILABLE");
    },
  };
}

/** My jokers in a league: the ones left and the ones played, with their event. */
export function getMyLeagueJokers(ports: {
  jokers: Pick<LeagueJokerRepository, "leagueJokers" | "plays">;
}) {
  return {
    async execute(input: { leagueId: string; userId: string }): Promise<JokerHand> {
      const [jokers, plays] = await Promise.all([
        ports.jokers.leagueJokers(input.leagueId),
        ports.jokers.plays(input.leagueId),
      ]);
      return jokerHand(
        known(jokers),
        plays.filter((p) => p.userId === input.userId),
      );
    },
  };
}

/** One league on the page of an event: my jokers there, seen from the event. */
export type EventLeagueJokers = { leagueId: string; hand: JokerHand };

/**
 * My jokers in each league given, seen from one event (#1090): the joker on it, the ones left,
 * whether it can still change. Leagues without any joker are left out.
 */
export function getEventLeagueJokers(ports: {
  jokers: Pick<LeagueJokerRepository, "leagueJokers" | "plays">;
}) {
  return {
    async execute(input: {
      userId: string;
      leagueIds: string[];
      event: { id: string; open: boolean };
    }): Promise<EventLeagueJokers[]> {
      const leagues = await Promise.all(
        input.leagueIds.map(async (leagueId) => {
          const [jokers, plays] = await Promise.all([
            ports.jokers.leagueJokers(leagueId),
            ports.jokers.plays(leagueId),
          ]);
          const mine = plays.filter((p) => p.userId === input.userId);
          return {
            leagueId,
            jokers: known(jokers),
            hand: jokerHand(known(jokers), mine, input.event),
          };
        }),
      );
      return leagues
        .filter((l) => l.jokers.length > 0)
        .map(({ leagueId, hand }) => ({ leagueId, hand }));
    },
  };
}

/**
 * Plays a joker on my prediction of the event in a league, or takes it back (`joker` null), until
 * the lock. Another joker on the event is replaced; the spy is never taken back.
 */
export function playLeagueJoker(ports: { jokers: Pick<LeagueJokerRepository, "play" | "remove"> }) {
  return {
    async execute(input: {
      leagueId: string;
      eventId: string;
      joker: PredictionJoker | null;
    }): Promise<void> {
      const outcome = input.joker
        ? await ports.jokers.play(input.leagueId, input.eventId, input.joker)
        : await ports.jokers.remove(input.leagueId, input.eventId);
      if (outcome !== "done") throw new UseCaseError(CODES[outcome]);
    },
  };
}

/**
 * « Espion »: before the lock, the trend of the predictions of the league's members on the event,
 * for a player who played the spy there. The database refuses it otherwise.
 */
export function getSpyTrend(ports: { consensus: ConsensusRepository }) {
  return {
    async execute(input: { leagueId: string; eventId: string }): Promise<Consensus> {
      return consensus(await ports.consensus.podiums(input.eventId, input.leagueId));
    },
  };
}
