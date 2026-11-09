import { UseCaseError } from "./errors";

/** A player as the admin sees them in the back-office « Joueurs » (#343). */
export type ModeratedPlayer = {
  id: string;
  pseudo: string;
  avatar: string;
  blocked: boolean;
  isAdmin: boolean;
  /** ISO 8601. */
  joinedAt: string;
  club: string | null;
  /** All the points of the general ranking. */
  points: number;
  predictions: number;
  leagues: number;
  /** ISO 8601: the latest sign-in, prediction or reaction. */
  lastActiveAt: string;
  /** Reports received by the public leagues this player created. */
  reports: number;
};

/** A player of the back-office list (#382), with their place in the general ranking. */
export type AdminPlayer = ModeratedPlayer & {
  /** Null for a blocked player or one without points: they are not in the ranking. */
  rank: number | null;
};

/** One league of a player, with their rank in it (#382). */
export type PlayerLeague = { id: string; name: string; memberCount: number; rank: number };

/**
 * Port: the admin's moderation of players. Real adapter = Supabase (the database checks the
 * admin and logs each action), fake = in memory. An admin cannot be blocked or deleted.
 */
export interface PlayerModerationRepository {
  /** Every player, the newest first. Never the e-mail address. */
  list(): Promise<ModeratedPlayer[] | "not_admin">;
  /** The leagues of a player and their rank in each. */
  leaguesOf(playerId: string): Promise<PlayerLeague[] | "not_admin">;
  setBlocked(playerId: string, blocked: boolean): Promise<"done" | "not_admin" | "unknown">;
  /** Deletes the account as if the player did it. */
  remove(playerId: string): Promise<"done" | "not_admin" | "unknown">;
}

type Ports = { players: PlayerModerationRepository };

const check = (outcome: "done" | "not_admin" | "unknown") => {
  if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
  if (outcome === "unknown") throw new UseCaseError("PLAYER_UNKNOWN");
};

/** The back-office list: every player, with their rank among the players who have points. */
export function listAdminPlayers(ports: Ports) {
  return {
    async execute(): Promise<AdminPlayer[]> {
      const players = await ports.players.list();
      if (players === "not_admin") throw new UseCaseError("NOT_ADMIN");
      const ranked = players.filter((p) => !p.blocked && p.points > 0).map((p) => p.points);
      return players.map((player) => ({
        ...player,
        rank:
          player.blocked || player.points <= 0
            ? null
            : 1 + ranked.filter((points) => points > player.points).length,
      }));
    },
  };
}

export function getPlayerLeagues(ports: Ports) {
  return {
    async execute(input: { playerId: string }): Promise<PlayerLeague[]> {
      const leagues = await ports.players.leaguesOf(input.playerId);
      if (leagues === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return leagues;
    },
  };
}

export function setPlayerBlocked(ports: Ports) {
  return {
    async execute(input: { playerId: string; blocked: boolean }): Promise<void> {
      check(await ports.players.setBlocked(input.playerId, input.blocked));
    },
  };
}

export function deletePlayer(ports: Ports) {
  return {
    async execute(input: { playerId: string }): Promise<void> {
      check(await ports.players.remove(input.playerId));
    },
  };
}
