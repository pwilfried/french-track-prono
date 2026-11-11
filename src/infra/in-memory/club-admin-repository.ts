import type { AdminClub, ClubAdminRepository } from "@/application/club-admin";
import { isBannedName } from "@/domain/banned-names";
import { matchesClub, searchKey } from "@/domain/club";

/** Test double of the ClubAdminRepository port: one store, a session per admin or not. */
type NewClub = Omit<AdminClub, "id" | "playerCount" | "createdAt">;

export function createInMemoryClubAdminStore(clubs: NewClub[] = []) {
  const all = new Map<string, AdminClub>();
  const add = (club: NewClub) => {
    const id = crypto.randomUUID();
    all.set(id, { ...club, id, playerCount: 0, createdAt: new Date().toISOString() });
    return id;
  };
  clubs.forEach(add);
  return {
    add,
    /** A player chooses this club. */
    join(id: string) {
      const club = all.get(id);
      if (club) club.playerCount += 1;
    },
    session({ isAdmin }: { isAdmin: boolean }): ClubAdminRepository {
      return {
        async list(query, pendingOnly, limit = 50) {
          if (!isAdmin) return "not_admin";
          // Same word rule as the sign-up search; an empty query lists every club.
          const everyClub = searchKey(query) === "";
          return [...all.values()]
            .filter((c) => (!pendingOnly || !c.validated) && (everyClub || matchesClub(query, c)))
            .sort(
              (a, b) =>
                Number(a.validated) - Number(b.validated) || a.name.localeCompare(b.name, "fr"),
            )
            .slice(0, Math.min(Math.max(limit, 1), 5000))
            .map((c) => ({ ...c }));
        },
        async save(id, club) {
          if (!isAdmin) return "not_admin";
          if (isBannedName(club.name) || isBannedName(club.city)) return "banned";
          if (id === null) return add({ ...club, source: "admin", validated: true });
          const found = all.get(id);
          if (!found) return "unknown";
          Object.assign(found, club);
          return id;
        },
        async validate(id) {
          if (!isAdmin) return "not_admin";
          const found = all.get(id);
          if (!found) return "unknown";
          found.validated = true;
          return "done";
        },
        async remove(id) {
          if (!isAdmin) return "not_admin";
          return all.delete(id) ? "done" : "unknown";
        },
        async merge(fromId, intoId) {
          if (!isAdmin) return "not_admin";
          if (fromId === intoId) return "same";
          const from = all.get(fromId);
          const into = all.get(intoId);
          if (!from || !into) return "unknown";
          into.playerCount += from.playerCount;
          all.delete(fromId);
          return from.playerCount;
        },
      };
    },
  };
}
