import { describe, it } from "vitest";

import { profileReminderContract } from "./contract/profile-reminder.contract";
import { signedInPlayer } from "./contract/test-player";
import {
  createInMemoryClubDirectory,
  createInMemoryPlayerDetailsRepository,
  createInMemoryProfileReminderRepository,
  createSupabasePlayerDetailsRepository,
  createSupabaseProfileReminderRepository,
} from "./index";

profileReminderContract("in-memory fake", async () => ({
  userId: "me",
  reminders: createInMemoryProfileReminderRepository(),
  details: createInMemoryPlayerDetailsRepository(createInMemoryClubDirectory()),
  // Each player only reaches their own store.
  other: { userId: "other", reminders: createInMemoryProfileReminderRepository() },
}));

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  profileReminderContract("Supabase (local)", async () => {
    const [me, other] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    return {
      userId: me.userId,
      reminders: createSupabaseProfileReminderRepository(me.client),
      details: createSupabasePlayerDetailsRepository(me.client),
      other: {
        userId: other.userId,
        reminders: createSupabaseProfileReminderRepository(other.client),
      },
    };
  });
} else {
  describe("Supabase profile reminder repository", () => {
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
