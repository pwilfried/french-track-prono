import { describe, expect, it } from "vitest";

import type { ProgramAlertRepository } from "@/application/program-alerts";

export type ProgramAlertWorld = {
  player: ProgramAlertRepository;
  other: ProgramAlertRepository;
  /** A competition whose programme is not published yet. */
  competitionSlug: string;
};

/** Contract of the ProgramAlertRepository port (#659), run against the fake AND Supabase. */
export function programAlertContract(name: string, world: () => Promise<ProgramAlertWorld>) {
  describe(`ProgramAlertRepository contract: ${name}`, () => {
    it("keeps an alert per player, turned off only by its owner", async () => {
      const w = await world();
      expect(await w.player.isOn(w.competitionSlug)).toBe(false);

      await w.player.turnOn(w.competitionSlug);
      await w.player.turnOn(w.competitionSlug);
      expect(await w.player.isOn(w.competitionSlug)).toBe(true);
      expect(await w.other.isOn(w.competitionSlug)).toBe(false);

      await w.other.turnOff(w.competitionSlug);
      expect(await w.player.isOn(w.competitionSlug)).toBe(true);

      await w.player.turnOff(w.competitionSlug);
      expect(await w.player.isOn(w.competitionSlug)).toBe(false);
    });
  });
}
