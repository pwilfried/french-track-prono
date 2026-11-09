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
};

/**
 * Port: the admin's moderation of players. Real adapter = Supabase (the database checks the
 * admin and logs each action), fake = in memory. An admin cannot be blocked or deleted.
 */
export interface PlayerModerationRepository {
  /** Players whose pseudo contains the query (accents and case ignored), blocked first. */
  search(query: string): Promise<ModeratedPlayer[] | "not_admin">;
  setBlocked(playerId: string, blocked: boolean): Promise<"done" | "not_admin" | "unknown">;
  /** Deletes the account as if the player did it. */
  remove(playerId: string): Promise<"done" | "not_admin" | "unknown">;
}

type Ports = { players: PlayerModerationRepository };

const check = (outcome: "done" | "not_admin" | "unknown") => {
  if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
  if (outcome === "unknown") throw new UseCaseError("PLAYER_UNKNOWN");
};

export function searchPlayers(ports: Ports) {
  return {
    async execute(input: { query: string }): Promise<ModeratedPlayer[]> {
      const found = await ports.players.search(input.query.trim().slice(0, 40));
      if (found === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return found;
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
