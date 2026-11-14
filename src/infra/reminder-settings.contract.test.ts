import { describe, it } from "vitest";

import { reminderSettingsContract } from "./contract/reminder-settings.contract";
import { signedInPlayer } from "./contract/test-player";
import {
  createInMemoryReminderSettingsStore,
  createSupabaseReminderSettingsRepository,
} from "./index";

reminderSettingsContract("in-memory fake", async () => {
  const store = createInMemoryReminderSettingsStore();
  return { player: store.session("me"), other: store.session("other") };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  reminderSettingsContract("Supabase (local)", async () => {
    const [player, other] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    return {
      player: createSupabaseReminderSettingsRepository(player.client),
      other: createSupabaseReminderSettingsRepository(other.client),
    };
  });
} else {
  describe("Supabase reminder settings repository", () => {
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
