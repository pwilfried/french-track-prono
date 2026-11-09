import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { playerDetailsContract } from "./contract/player-details.contract";
import { signedInPlayer } from "./contract/test-player";
import {
  createInMemoryClubDirectory,
  createInMemoryPlayerDetailsRepository,
  createSupabaseClubDirectory,
  createSupabasePlayerDetailsRepository,
} from "./index";

playerDetailsContract("in-memory fake", async () => {
  const mine = createInMemoryClubDirectory();
  const details = createInMemoryPlayerDetailsRepository(mine);
  // The other player shares the clubs but not what this player typed.
  const theirs = createInMemoryClubDirectory();
  const otherDetails = createInMemoryPlayerDetailsRepository(theirs);
  return {
    userId: "me",
    clubs: mine,
    details,
    async importClub(name) {
      const club = mine.add({ name, city: "", department: "" });
      return club.id;
    },
    other: {
      userId: "other",
      clubs: theirs,
      details: {
        find: async (userId) =>
          userId === "me" ? otherDetails.find("nobody") : otherDetails.find(userId),
        save: otherDetails.save,
      },
    },
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;

if (url && key) {
  playerDetailsContract("Supabase (local)", async () => {
    const [me, other] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    return {
      userId: me.userId,
      clubs: createSupabaseClubDirectory(me.client),
      details: createSupabasePlayerDetailsRepository(me.client),
      async importClub(name) {
        const siren = String(Math.floor(100_000_000 + Math.random() * 899_999_999));
        sql(
          `select import_clubs(${quote(JSON.stringify([{ name, city: "", department: "", siren }]))}::jsonb)`,
        );
        return sql(`select id from clubs where siren = '${siren}'`);
      },
      other: {
        userId: other.userId,
        clubs: createSupabaseClubDirectory(other.client),
        details: createSupabasePlayerDetailsRepository(other.client),
      },
    };
  });
} else {
  describe("Supabase player details repository", () => {
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
