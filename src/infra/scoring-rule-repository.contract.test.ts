import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { scoringRuleRepositoryContract } from "./contract/scoring-rule-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryScoringRuleStore, createSupabaseScoringRuleRepository } from "./index";

scoringRuleRepositoryContract("in-memory fake", async () => {
  const store = createInMemoryScoringRuleStore([
    { key: "exact_slot", value: 3 },
    { key: "odds_exact", value: 3 },
    { key: "mark_exact", value: 5 },
    { key: "mark_near", value: 2 },
  ]);
  return {
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false }),
    restore: async () => {},
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  scoringRuleRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const before = sql("select value from scoring_rules where key = 'mark_exact'");
    return {
      admin: createSupabaseScoringRuleRepository(admin.client),
      player: createSupabaseScoringRuleRepository(player.client),
      restore: async () =>
        void sql(`update scoring_rules set value = ${before} where key = 'mark_exact'`),
    };
  });
} else {
  describe("Supabase scoring rule repository", () => {
    const message = "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set";
    if (process.env.REQUIRE_SUPABASE_TESTS) {
      it("has a local Supabase configured", () => {
        throw new Error(message);
      });
    } else {
      it.skip(`is skipped: ${message}`, () => {});
    }
  });
}
