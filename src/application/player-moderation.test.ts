import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  deletePlayer,
  getPlayerLeagues,
  listAdminPlayers,
  setPlayerBlocked,
  type ModeratedPlayer,
  type PlayerModerationRepository,
} from "./player-moderation";

// Application tests do not import the infra layer: a few lines of fake are enough here.
function fakePlayers(isAdmin = true): PlayerModerationRepository & { all: ModeratedPlayer[] } {
  const player = (id: string, pseudo: string, points: number): ModeratedPlayer => ({
    id,
    pseudo,
    avatar: "🦌",
    blocked: false,
    isAdmin: false,
    joinedAt: "2026-11-01T00:00:00.000Z",
    club: null,
    points,
    predictions: 3,
    leagues: 1,
    lastActiveAt: "2026-11-09T00:00:00.000Z",
    reports: 0,
  });
  const all: ModeratedPlayer[] = [
    player("p1", "Gazelle", 20),
    player("p2", "Guépard", 30),
    player("p3", "Haie", 20),
    player("p4", "Novice", 0),
  ];
  const find = (id: string) => all.find((p) => p.id === id);
  return {
    all,
    async list() {
      return isAdmin ? all.map((p) => ({ ...p })) : "not_admin";
    },
    async leaguesOf(id) {
      if (!isAdmin) return "not_admin";
      return id === "p1" ? [{ id: "l1", name: "Team", memberCount: 8, rank: 1 }] : [];
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
  it("lists the players with their rank, ties sharing it, none without points", async () => {
    // given four players, two of them level
    const players = fakePlayers();
    // when the admin opens the list
    const list = await listAdminPlayers({ players }).execute();
    // then each has their place in the general ranking
    expect(list.map((p) => [p.pseudo, p.rank])).toEqual([
      ["Gazelle", 2],
      ["Guépard", 1],
      ["Haie", 2],
      ["Novice", null],
    ]);
  });

  it("leaves a blocked player out of the ranking", async () => {
    const players = fakePlayers();
    await setPlayerBlocked({ players }).execute({ playerId: "p2", blocked: true });
    const list = await listAdminPlayers({ players }).execute();
    expect(list.map((p) => p.rank)).toEqual([1, null, 1, null]);
  });

  it("gives the leagues of a player with their rank", async () => {
    const leagues = await getPlayerLeagues({ players: fakePlayers() }).execute({ playerId: "p1" });
    expect(leagues).toEqual([{ id: "l1", name: "Team", memberCount: 8, rank: 1 }]);
  });

  it("blocks a player, then deletes them", async () => {
    const players = fakePlayers();
    // when the admin blocks then deletes Gazelle
    await setPlayerBlocked({ players }).execute({ playerId: "p1", blocked: true });
    expect(players.all[0]!.blocked).toBe(true);
    await deletePlayer({ players }).execute({ playerId: "p1" });
    // then she is gone
    expect(players.all.map((p) => p.pseudo)).toEqual(["Guépard", "Haie", "Novice"]);
  });

  it("says when the player is gone", async () => {
    await expect(
      deletePlayer({ players: fakePlayers() }).execute({ playerId: "x" }),
    ).rejects.toEqual(new UseCaseError("PLAYER_UNKNOWN"));
  });

  it("refuses a player who is not admin", async () => {
    const players = fakePlayers(false);
    await expect(listAdminPlayers({ players }).execute()).rejects.toEqual(
      new UseCaseError("NOT_ADMIN"),
    );
    await expect(
      setPlayerBlocked({ players }).execute({ playerId: "p1", blocked: true }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });
});
