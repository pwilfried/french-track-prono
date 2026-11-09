import type {
  ModeratedPlayer,
  PlayerLeague,
  PlayerModerationRepository,
} from "@/application/player-moderation";

type NewPlayer = Pick<ModeratedPlayer, "id" | "pseudo" | "avatar" | "isAdmin" | "joinedAt"> &
  Partial<ModeratedPlayer>;

/** Test double of the PlayerModerationRepository port: one store, a session per admin or not. */
export function createInMemoryPlayerStore(players: NewPlayer[] = []) {
  const all = new Map<string, ModeratedPlayer>();
  const leagues = new Map<string, PlayerLeague[]>();
  const add = (player: NewPlayer) =>
    all.set(player.id, {
      blocked: false,
      club: null,
      points: 0,
      predictions: 0,
      leagues: 0,
      lastActiveAt: player.joinedAt,
      reports: 0,
      ...player,
    });
  players.forEach(add);
  return {
    add,
    /** The player is alone in a new league. */
    joinLeague(playerId: string, name: string) {
      const list = leagues.get(playerId) ?? [];
      list.push({ id: crypto.randomUUID(), name, memberCount: 1, rank: 1 });
      leagues.set(playerId, list);
      const player = all.get(playerId);
      if (player) player.leagues = list.length;
    },
    session({ isAdmin }: { isAdmin: boolean }): PlayerModerationRepository {
      const target = (id: string) => {
        const player = all.get(id);
        return player && !player.isAdmin ? player : null;
      };
      return {
        async list() {
          if (!isAdmin) return "not_admin";
          return [...all.values()]
            .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
            .map((p) => ({ ...p }));
        },
        async leaguesOf(id) {
          if (!isAdmin) return "not_admin";
          return (leagues.get(id) ?? []).map((l) => ({ ...l }));
        },
        async setBlocked(id, blocked) {
          if (!isAdmin) return "not_admin";
          const player = target(id);
          if (!player) return "unknown";
          player.blocked = blocked;
          return "done";
        },
        async remove(id) {
          if (!isAdmin) return "not_admin";
          if (!target(id)) return "unknown";
          all.delete(id);
          return "done";
        },
      };
    },
  };
}
