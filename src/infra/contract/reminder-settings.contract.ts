import { describe, expect, it } from "vitest";

import type { ReminderSettingsRepository } from "@/application/reminder-settings";
import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from "@/domain/reminders";

export type ReminderSettingsWorld = {
  player: ReminderSettingsRepository;
  other: ReminderSettingsRepository;
};

/** Contract of the ReminderSettingsRepository port (#681), run against the fake AND Supabase. */
export function reminderSettingsContract(
  name: string,
  world: () => Promise<ReminderSettingsWorld>,
) {
  describe(`ReminderSettingsRepository contract: ${name}`, () => {
    it("keeps each player's settings, replaced when saved again", async () => {
      const w = await world();
      expect(await w.player.load()).toBeNull();

      const mine: ReminderSettings = {
        families: { ...DEFAULT_REMINDER_SETTINGS.families, manager: false, league: false },
        leadMinutes: 180,
        quietFrom: 22,
        quietTo: 7,
      };
      await w.player.save(DEFAULT_REMINDER_SETTINGS);
      await w.player.save(mine);
      expect(await w.player.load()).toEqual(mine);
      expect(await w.other.load()).toBeNull();
    });
  });
}
