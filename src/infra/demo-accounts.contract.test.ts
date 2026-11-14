import { createClient } from "@supabase/supabase-js";
import { describe, it } from "vitest";

import { demoAccountsContract } from "./contract/demo-accounts.contract";
import { createInMemoryDemoAccounts, createSupabaseDemoAccounts } from "./index";

demoAccountsContract("in-memory fake", () => {
  const demo = createInMemoryDemoAccounts();
  return {
    demo,
    async addAccount(email, pseudo) {
      const userId = crypto.randomUUID();
      demo.add({ userId, email, pseudo });
      return userId;
    },
    async openSession(token) {
      return demo.openSession(token);
    },
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && anon && serviceKey) {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  demoAccountsContract("Supabase (local)", () => {
    const service = createClient(url, serviceKey, options);
    return {
      demo: createSupabaseDemoAccounts(service),
      async addAccount(email, pseudo) {
        const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true });
        if (error || !data.user) throw new Error(`test account: ${error?.message}`);
        const profile = await service.from("profiles").insert({
          id: data.user.id,
          pseudo,
          age_confirmed_at: new Date().toISOString(),
        });
        if (profile.error) throw new Error(`test profile: ${profile.error.message}`);
        return data.user.id;
      },
      async openSession(token) {
        const visitor = createClient(url, anon, options);
        const { data, error } = await visitor.auth.verifyOtp({ token_hash: token, type: "email" });
        return error || !data.user ? null : data.user.id;
      },
    };
  });
} else {
  describe("Supabase demo accounts", () => {
    const message =
      "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are not set";
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
