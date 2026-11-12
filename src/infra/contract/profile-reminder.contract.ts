import { describe, expect, it } from "vitest";

import type { PlayerDetailsRepository } from "@/application/player-details";
import type { ProfileReminderRepository } from "@/application/profile-reminder";

export type ProfileReminderWorld = {
  userId: string;
  reminders: ProfileReminderRepository;
  details: PlayerDetailsRepository;
  /** Another player's view, to check privacy. */
  other: { userId: string; reminders: ProfileReminderRepository };
};

/** Contract of the ProfileReminderRepository port (#540). */
export function profileReminderContract(name: string, world: () => Promise<ProfileReminderWorld>) {
  describe(`ProfileReminderRepository contract: ${name}`, () => {
    it("starts with the card not hidden", async () => {
      const w = await world();
      expect(await w.reminders.hiddenUntil(w.userId)).toBeNull();
    });

    it("remembers until when the card is hidden, keeping the other details", async () => {
      const w = await world();
      await w.details.save(w.userId, { sex: "F", disciplines: ["800 m"], clubId: null });
      const until = new Date("2026-12-12T08:00:00.000Z");

      await w.reminders.hideUntil(w.userId, until);

      expect((await w.reminders.hiddenUntil(w.userId))?.toISOString()).toBe(until.toISOString());
      expect(await w.details.find(w.userId)).toMatchObject({ sex: "F", disciplines: ["800 m"] });
    });

    it("keeps the date when the details are saved again", async () => {
      const w = await world();
      const until = new Date("2026-12-12T08:00:00.000Z");
      await w.reminders.hideUntil(w.userId, until);

      await w.details.save(w.userId, { sex: null, disciplines: ["100 m"], clubId: null });

      expect((await w.reminders.hiddenUntil(w.userId))?.toISOString()).toBe(until.toISOString());
    });

    it("keeps the date private to the player", async () => {
      const w = await world();
      await w.reminders.hideUntil(w.userId, new Date("2026-12-12T08:00:00.000Z"));
      expect(await w.other.reminders.hiddenUntil(w.userId)).toBeNull();
    });
  });
}
