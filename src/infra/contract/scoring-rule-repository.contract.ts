import { describe, expect, it } from "vitest";

import type { ScoringRuleRepository } from "@/application/scoring-rules";

/** An admin session, a player session, and a way to put the changed value back. */
export type ScoringRuleWorld = {
  admin: ScoringRuleRepository;
  player: ScoringRuleRepository;
  /** Puts mark_exact back as it was. */
  restore: () => Promise<void>;
};

/** Contract of the ScoringRuleRepository port, run against the in-memory fake AND Supabase. */
export function scoringRuleRepositoryContract(
  name: string,
  world: () => Promise<ScoringRuleWorld>,
) {
  describe(`ScoringRuleRepository contract: ${name}`, () => {
    it("lists the scale with the v0.9 values for odds and marks", async () => {
      const w = await world();
      const rules = new Map((await w.player.list()).map((r) => [r.key, r.value]));

      expect(rules.get("exact_slot")).toBe(3);
      expect(rules.get("odds_exact")).toBe(3);
      expect(rules.get("mark_near")).toBe(2);
    });

    it("lets an admin change a value, refuses a player and an unknown rule", async () => {
      const w = await world();
      try {
        expect(await w.player.set("mark_exact", 9)).toBe("not_admin");
        expect(await w.admin.set("no_such_rule", 2)).toBe("unknown");
        expect(await w.admin.set("mark_exact", 6)).toBe("saved");

        expect((await w.player.list()).find((r) => r.key === "mark_exact")?.value).toBe(6);
      } finally {
        await w.restore();
      }
    });
  });
}
