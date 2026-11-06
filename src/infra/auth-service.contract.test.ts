import { createClient } from "@supabase/supabase-js";
import { describe, it } from "vitest";

import { authServiceContract } from "./contract/auth-service.contract";
import { createInMemoryAuthService, createSupabaseAuthService } from "./index";

authServiceContract("in-memory fake", () => {
  const auth = createInMemoryAuthService();
  return { auth, latestCode: auth.latestCode };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const mailbox = process.env.SUPABASE_MAILBOX_URL ?? "http://127.0.0.1:54324";

/** Reads the 6-digit code of the latest message sent to an address in the local test mailbox. */
async function latestCodeFromMailbox(email: string): Promise<string> {
  let seen = "no message";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const search = await fetch(
      `${mailbox}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const { messages } = (await search.json()) as { messages?: { ID: string }[] };
    const id = messages?.[0]?.ID;
    if (id) {
      const message = (await (await fetch(`${mailbox}/api/v1/message/${id}`)).json()) as {
        Text?: string;
        HTML?: string;
        Subject?: string;
      };
      // The template is HTML: read the text part when there is one, else the HTML without tags.
      const body = message.Text || (message.HTML ?? "").replace(/<[^>]+>/g, " ");
      const match = /Code de connexion\s*:\s*(\d{6})/.exec(body);
      if (match?.[1]) return match[1];
      seen = `message "${message.Subject}" without the code, start of body: ${body.slice(0, 200)}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no sign-in code found for ${email} in ${mailbox} (${seen})`);
}

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
