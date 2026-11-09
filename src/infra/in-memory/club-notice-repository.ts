import type { ClubNotice, ClubNoticeRepository } from "@/application/club-notices";

/** Test double of the ClubNoticeRepository port: one store, a session per player. */
export function createInMemoryClubNoticeStore() {
  const all: (ClubNotice & { playerId: string; seen: boolean })[] = [];
  return {
    add(playerId: string, notice: Omit<ClubNotice, "id">) {
      all.push({ ...notice, id: crypto.randomUUID(), playerId, seen: false });
    },
    session(playerId: string): ClubNoticeRepository {
      return {
        async listUnseen() {
          return all
            .filter((n) => n.playerId === playerId && !n.seen)
            .map(({ id, kind, clubName, newName }) => ({ id, kind, clubName, newName }));
        },
        async dismiss(id) {
          const notice = all.find((n) => n.id === id && n.playerId === playerId);
          if (notice) notice.seen = true;
        },
      };
    },
  };
}
