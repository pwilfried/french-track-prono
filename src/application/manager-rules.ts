import { isPlayableManagerRules, type ManagerRules } from "@/domain/manager-rules";

import { UseCaseError } from "./errors";

/** The rules of French Track Manager and the competitions its seasons are played on. */
export type ManagerRuleSet = { rules: ManagerRules; competitionSlugs: string[] };

/** Port: the Manager rules. Real adapter = Supabase (writes need an admin session), fake = in memory. */
export interface ManagerRuleRepository {
  get(): Promise<ManagerRuleSet>;
  save(set: ManagerRuleSet): Promise<"saved" | "not_admin" | "unknown_competition">;
}

export function getManagerRules(ports: { rules: ManagerRuleRepository }) {
  return { execute: () => ports.rules.get() };
}

/** The admin of French Track Prono replaces the rules; leagues already created keep theirs. */
export function setManagerRules(ports: { rules: ManagerRuleRepository }) {
  return {
    async execute(input: ManagerRuleSet): Promise<void> {
      if (!isPlayableManagerRules(input.rules)) throw new UseCaseError("MANAGER_RULES_INVALID");
      const outcome = await ports.rules.save({
        rules: input.rules,
        competitionSlugs: [...new Set(input.competitionSlugs)],
      });
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (outcome === "unknown_competition") throw new UseCaseError("COMPETITION_NOT_FOUND");
    },
  };
}
