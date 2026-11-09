import type { ModeratedPlayer, PlayerModerationRepository } from "@/application/player-moderation";

const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Test double of the PlayerModerationRepository port: one store, a session per admin or not. */
export function createInMemoryPlayerStore(players: Omit<ModeratedPlayer, "blocked">[] = []) {
  const all = new Map<string, ModeratedPlayer>(
    players.map((p) => [p.id, { ...p, blocked: false }]),
  );
  return {
    add(player: Omit<ModeratedPlayer, "blocked">) {
      all.set(player.id, { ...player, blocked: false });
    },
    session({ isAdmin }: { isAdmin: boolean }): PlayerModerationRepository {
      const target = (id: string) => {
        const player = all.get(id);
        return player && !player.isAdmin ? player : null;
      };
      return {
        async search(query) {
          if (!isAdmin) return "not_admin";
          return [...all.values()]
            .filter((p) => plain(p.pseudo).includes(plain(query.trim())))
            .sort(
              (a, b) =>
                Number(b.blocked) - Number(a.blocked) ||
                a.pseudo.toLowerCase().localeCompare(b.pseudo.toLowerCase()),
            )
            .slice(0, 30)
            .map((p) => ({ ...p }));
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
