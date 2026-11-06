import { createClient } from "@supabase/supabase-js";
import { describe, it } from "vitest";

import { authServiceContract } from "./contract/auth-service.contract";
import { latestCodeFromMailbox } from "./contract/mailbox";
import { createInMemoryAuthService, createSupabaseAuthService } from "./index";

authServiceContract("in-memory fake", () => {
  const auth = createInMemoryAuthService();
  return { auth, latestCode: auth.latestCode };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (url && key) {
  authServiceContract("Supabase (local)", () => ({
    auth: createSupabaseAuthService(
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    ),
    latestCode: latestCodeFromMailbox,
  }));
} else {
  describe("Supabase auth service", () => {
    const message = "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set";
    // In CI the run must fail rather than silently skip these tests.
    if (process.env.REQUIRE_SUPABASE_TESTS) {
      it("has a local Supabase configured", () => {
        throw new Error(message);
      });
    } else {
      it.skip(`is skipped: ${message}`, () => {});
    }
  });
}
