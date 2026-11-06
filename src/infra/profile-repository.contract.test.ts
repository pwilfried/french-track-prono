import { createClient } from "@supabase/supabase-js";
import { describe, it } from "vitest";

import { latestCodeFromMailbox } from "./contract/mailbox";
import { profileRepositoryContract } from "./contract/profile-repository.contract";
import { createInMemoryProfileRepository, createSupabaseProfileRepository } from "./index";

const shared = createInMemoryProfileRepository();
profileRepositoryContract("in-memory fake", async () => ({
  userId: crypto.randomUUID(),
  profiles: shared,
}));

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  /** A real player: signs in with the e-mail code, then writes through their own session. */
  const signedInPlayer = async () => {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `player-${crypto.randomUUID()}@example.test`;
    await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    const token = await latestCodeFromMailbox(email);
    const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data.user)
      throw new Error(`could not sign the test player in: ${error?.message}`);
    return { userId: data.user.id, profiles: createSupabaseProfileRepository(client) };
  };
  profileRepositoryContract("Supabase (local)", signedInPlayer);
} else {
  describe("Supabase profile repository", () => {
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
