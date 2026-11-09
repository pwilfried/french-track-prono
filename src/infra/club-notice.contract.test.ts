import { describe, it } from "vitest";

import { clubNoticeContract } from "./contract/club-notice.contract";
import { sql } from "./contract/database";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryClubNoticeStore, createSupabaseClubNoticeRepository } from "./index";

clubNoticeContract("in-memory fake", async () => {
  const store = createInMemoryClubNoticeStore();
  return {
    player: store.session("me"),
    other: store.session("other"),
    async validateThenRename(name, newName) {
      store.add("me", { kind: "validated", clubName: name, newName: null });
      store.add("me", { kind: "renamed", clubName: name, newName });
    },
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;

if (url && key) {
  clubNoticeContract("Supabase (local)", async () => {
    const [player, other] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    return {
      player: createSupabaseClubNoticeRepository(player.client),
      other: createSupabaseClubNoticeRepository(other.client),
      async validateThenRename(name, newName) {
        const id = sql(`insert into clubs (name, source, created_by)
          values (${quote(name)}, 'player', '${player.userId}') returning id`);
        sql(`update profiles set club_id = '${id}' where id = '${player.userId}'`);
        sql(`update clubs set validated = true where id = '${id}'`);
        sql(`update clubs set name = ${quote(newName)} where id = '${id}'`);
      },
    };
  });
} else {
  describe("Supabase club notice repository", () => {
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
