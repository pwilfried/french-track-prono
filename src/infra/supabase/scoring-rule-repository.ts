import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ScoringRuleRepository } from "@/application/scoring-rules";

/** Reads need a signed-in session; writes go through admin_set_scoring_rule (admins only). */
export function createSupabaseScoringRuleRepository(client: SupabaseClient): ScoringRuleRepository {
  return {
    async list() {
      const { data, error } = await client
        .from("scoring_rules")
        .select("key, value")
        .returns<{ key: string; value: number | string }[]>();
      if (error) throw new UseCaseError("SCORING_RULES_UNAVAILABLE");
      return data.map((row) => ({ key: row.key, value: Number(row.value) }));
    },

    async set(key, value) {
      const { error } = await client.rpc("admin_set_scoring_rule", { p_key: key, p_value: value });
      if (!error) return "saved";
      if (error.code === "42501") return "not_admin";
      if (error.code === "FT007") return "unknown";
      if (error.code === "22023") throw new UseCaseError("SCORING_RULE_INVALID");
      throw new UseCaseError("SCORING_RULES_UNAVAILABLE");
    },
  };
}
