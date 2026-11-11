import type { ManagerRuleRepository, ManagerRuleSet } from "@/application/manager-rules";

/** Test double of the ManagerRuleRepository port: one store, a session per player. */
export function createInMemoryManagerRuleStore(
  initial: ManagerRuleSet,
  competitionSlugs: string[],
) {
  let stored = structuredClone(initial);
  return {
    session(options: { isAdmin: boolean }): ManagerRuleRepository {
      return {
        async get() {
          return structuredClone(stored);
        },
        async save(set) {
          if (!options.isAdmin) return "not_admin";
          if (!set.competitionSlugs.every((s) => competitionSlugs.includes(s))) {
            return "unknown_competition";
          }
          stored = structuredClone(set);
          return "saved";
        },
      };
    },
  };
}
