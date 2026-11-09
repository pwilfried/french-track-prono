import { createClient } from "@supabase/supabase-js";
import { describe, it } from "vitest";

import { emailChangeContract } from "./contract/email-change-service.contract";
import { clearMailbox, latestCodeFromMailbox } from "./contract/mailbox";
import { createInMemoryEmailChangeService, createSupabaseEmailChangeService } from "./index";

emailChangeContract("in-memory fake", async () => {
  const emails = createInMemoryEmailChangeService({
    email: "me@example.test",
    taken: ["other@example.test"],
  });
  return {
    emails,
    latestCode: emails.latestCode,
    currentEmail: async () => emails.currentEmail(),
    takenEmail: "other@example.test",
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function signIn(email: string) {
  if (!url || !key) throw new Error("no Supabase");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  const { error } = await client.auth.verifyOtp({
    email,
    token: await latestCodeFromMailbox(email),
    type: "email",
  });
  if (error) throw new Error(`could not sign the test player in: ${error.message}`);
  await clearMailbox(email);
  return client;
}

if (url && key) {
  emailChangeContract("Supabase (local)", async () => {
    const takenEmail = `taken-${crypto.randomUUID()}@example.test`;
    const [client] = await Promise.all([
      signIn(`player-${crypto.randomUUID()}@example.test`),
      signIn(takenEmail),
    ]);
    return {
      emails: createSupabaseEmailChangeService(client),
      latestCode: latestCodeFromMailbox,
      async currentEmail() {
        const { data } = await client.auth.getUser();
        return data.user?.email ?? "";
      },
      takenEmail,
    };
  });
} else {
  describe("Supabase e-mail change service", () => {
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
