import { describe, it } from "vitest";

import { funFactRepositoryContract } from "./contract/fun-fact-repository.contract";
import { sql } from "./contract/database";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryFunFactStore, createSupabaseFunFactRepository } from "./index";

funFactRepositoryContract("in-memory fake", async () => {
  const store = createInMemoryFunFactStore({
    admins: ["adm"],
    competitions: ["meeting-faits-2031"],
    disciplines: ["100 m"],
  });
  return {
    admin: store.session("adm"),
    player: store.session("ana"),
    competitionSlug: "meeting-faits-2031",
    discipline: "100 m",
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  funFactRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const slug = `meeting-faits-${crypto.randomUUID().slice(0, 8)}`;
    sql(`insert into competitions (slug, name, starts_on, ends_on)
      values ('${slug}', 'Meeting Faits', '2031-07-10', '2031-07-12')`);
    return {
      admin: createSupabaseFunFactRepository(admin.client),
      player: createSupabaseFunFactRepository(player.client),
      competitionSlug: slug,
      discipline: "100 m",
    };
  });
} else {
  describe("Supabase fun fact repository", () => {
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
