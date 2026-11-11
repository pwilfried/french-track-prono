import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ManagerRuleRepository } from "@/application/manager-rules";
import type { ManagerRules } from "@/domain/manager-rules";

/** Reads need a signed-in session; writes go through admin_set_manager_rules (admins only). */
export function createSupabaseManagerRuleRepository(client: SupabaseClient): ManagerRuleRepository {
  return {
    async get() {
      const [rules, competitions] = await Promise.all([
        client.from("manager_rules").select("rules").single<{ rules: ManagerRules }>(),
        client
          .from("manager_competitions")
          .select("competitions(slug)")
          .returns<{ competitions: { slug: string } }[]>(),
      ]);
      if (rules.error || competitions.error) throw new UseCaseError("MANAGER_RULES_UNAVAILABLE");
      return {
        rules: rules.data.rules,
        competitionSlugs: competitions.data.map((row) => row.competitions.slug).sort(),
      };
    },

    async save(set) {
      const { error } = await client.rpc("admin_set_manager_rules", {
        p_rules: set.rules,
        p_competition_slugs: set.competitionSlugs,
      });
      if (!error) return "saved";
      if (error.code === "42501") return "not_admin";
      if (error.code === "P0002") return "unknown_competition";
      if (error.code === "22023") throw new UseCaseError("MANAGER_RULES_INVALID");
      throw new UseCaseError("MANAGER_RULES_UNAVAILABLE");
    },
  };
}
