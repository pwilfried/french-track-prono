import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  deletePlayer,
  searchPlayers,
  setPlayerBlocked,
  type ModeratedPlayer,
  type PlayerModerationRepository,
} from "./player-moderation";

// Application tests do not import the infra layer: a few lines of fake are enough here.
function fakePlayers(isAdmin = true): PlayerModerationRepository & { all: ModeratedPlayer[] } {
  const all: ModeratedPlayer[] = [
    { id: "p1", pseudo: "Gazelle", avatar: "🦌", blocked: false, isAdmin: false, joinedAt: "" },
    { id: "p2", pseudo: "Guépard", avatar: "🐆", blocked: false, isAdmin: false, joinedAt: "" },
  ];
  const find = (id: string) => all.find((p) => p.id === id);
  return {
    all,
    async search(query) {
      return isAdmin
        ? all.filter((p) => p.pseudo.toLowerCase().includes(query.toLowerCase()))
        : "not_admin";
    },
    async setBlocked(id, blocked) {
      if (!isAdmin) return "not_admin";
      const player = find(id);
      if (!player) return "unknown";
      player.blocked = blocked;
      return "done";
    },
    async remove(id) {
      if (!isAdmin) return "not_admin";
      const index = all.findIndex((p) => p.id === id);
      if (index < 0) return "unknown";
      all.splice(index, 1);
      return "done";
    },
  };
}

describe("the admin moderates players", () => {
  it("finds a player, blocks them, then deletes them", async () => {
    // given two players, when the admin looks for "gaz"
    const players = fakePlayers();
    const found = await searchPlayers({ players }).execute({ query: "  gaz " });
    expect(found.map((p) => p.pseudo)).toEqual(["Gazelle"]);
    // and blocks then deletes Gazelle
    await setPlayerBlocked({ players }).execute({ playerId: "p1", blocked: true });
    expect(players.all[0]!.blocked).toBe(true);
    await deletePlayer({ players }).execute({ playerId: "p1" });
    // then only Guépard is left
    expect(players.all.map((p) => p.pseudo)).toEqual(["Guépard"]);
  });

  it("says when the player is gone", async () => {
    await expect(
      deletePlayer({ players: fakePlayers() }).execute({ playerId: "x" }),
    ).rejects.toEqual(new UseCaseError("PLAYER_UNKNOWN"));
  });

  it("refuses a player who is not admin", async () => {
    const players = fakePlayers(false);
    await expect(searchPlayers({ players }).execute({ query: "a" })).rejects.toEqual(
      new UseCaseError("NOT_ADMIN"),
    );
    await expect(
      setPlayerBlocked({ players }).execute({ playerId: "p1", blocked: true }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });
});
