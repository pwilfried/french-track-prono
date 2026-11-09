import type { AdminClub, ClubAdminRepository } from "@/application/club-admin";
import { isBannedName } from "@/domain/banned-names";
import { searchKey } from "@/domain/club";

/** Test double of the ClubAdminRepository port: one store, a session per admin or not. */
export function createInMemoryClubAdminStore(clubs: Omit<AdminClub, "id" | "playerCount">[] = []) {
  const all = new Map<string, AdminClub>();
  const add = (club: Omit<AdminClub, "id" | "playerCount">) => {
    const id = crypto.randomUUID();
    all.set(id, { ...club, id, playerCount: 0 });
    return id;
  };
  clubs.forEach(add);
  return {
    add,
    session({ isAdmin }: { isAdmin: boolean }): ClubAdminRepository {
      return {
        async list(query, pendingOnly) {
          if (!isAdmin) return "not_admin";
          const key = searchKey(query);
          return [...all.values()]
            .filter(
              (c) =>
                (!pendingOnly || !c.validated) && searchKey(`${c.name} ${c.city}`).includes(key),
            )
            .sort(
              (a, b) =>
                Number(a.validated) - Number(b.validated) || a.name.localeCompare(b.name, "fr"),
            )
            .slice(0, 50)
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
      };
    },
  };
}
