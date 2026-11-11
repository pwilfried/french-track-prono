import { describe, expect, it } from "vitest";

import type { ManagerRuleRepository } from "@/application/manager-rules";

/** An admin session, a player session, a competition that exists, and a way to undo. */
export type ManagerRuleWorld = {
  admin: ManagerRuleRepository;
  player: ManagerRuleRepository;
  competitionSlug: string;
  restore: () => Promise<void>;
};

/** Contract of the ManagerRuleRepository port, run against the in-memory fake AND Supabase. */
export function managerRuleRepositoryContract(
  name: string,
  world: () => Promise<ManagerRuleWorld>,
) {
  describe(`ManagerRuleRepository contract: ${name}`, () => {
    it("lets an admin replace the rules and the competitions, refuses a player", async () => {
      const w = await world();
      try {
        const before = await w.player.get();
        const changed = {
          rules: { ...before.rules, budget: before.rules.budget + 1 },
          competitionSlugs: [w.competitionSlug],
        };

        expect(await w.player.save(changed)).toBe("not_admin");
        expect(await w.admin.save({ ...changed, competitionSlugs: ["no-such-meeting"] })).toBe(
          "unknown_competition",
        );
        expect(await w.admin.save(changed)).toBe("saved");

        expect(await w.player.get()).toEqual(changed);
      } finally {
        await w.restore();
      }
    });
  });
}
