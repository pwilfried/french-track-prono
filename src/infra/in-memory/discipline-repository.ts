import type { DisciplineRepository } from "@/application/disciplines";
import type { Discipline } from "@/domain/discipline";

/** Test double of the DisciplineRepository port: one store, a session per player. */
export function createInMemoryDisciplineStore(disciplines: Discipline[]) {
  const stored = disciplines.map((d) => ({ ...d }));
  return {
    session(options: { isAdmin: boolean }): DisciplineRepository {
      return {
        async list() {
          return stored.map((d) => ({ ...d }));
        },
        async setTolerance(name, tolerance) {
          if (!options.isAdmin) return "not_admin";
          const found = stored.find((d) => d.name === name);
          if (!found) return "unknown";
          found.tolerance = tolerance;
          return "saved";
        },
      };
    },
  };
}
