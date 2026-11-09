import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { playerModerationContract } from "./contract/player-moderation.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryPlayerStore, createSupabasePlayerModerationRepository } from "./index";

playerModerationContract("in-memory fake", async () => {
  const store = createInMemoryPlayerStore([
    {
      id: "admin",
      pseudo: "Admin",
      avatar: "🦅",
      isAdmin: true,
      joinedAt: "2026-11-01T00:00:00.000Z",
    },
  ]);
  return {
    admin: store.session({ isAdmin: true }),
    notAdmin: store.session({ isAdmin: false }),
    adminId: "admin",
    async newPlayer(pseudo) {
      const id = crypto.randomUUID();
      store.add({ id, pseudo, avatar: "🦊", isAdmin: false, joinedAt: new Date().toISOString() });
      return id;
    },
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  playerModerationContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    return {
      admin: createSupabasePlayerModerationRepository(admin.client),
      notAdmin: createSupabasePlayerModerationRepository(player.client),
      adminId: admin.userId,
      async newPlayer(pseudo) {
        const other = await signedInPlayer(url, key);
        sql(
          `update profiles set pseudo = '${pseudo.replaceAll("'", "''")}' where id = '${other.userId}'`,
        );
        return other.userId;
      },
    };
  });
} else {
  describe("Supabase player moderation repository", () => {
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
