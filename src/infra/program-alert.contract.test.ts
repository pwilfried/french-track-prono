import { describe, it } from "vitest";

import { createTestCompetition } from "./contract/database";
import { programAlertContract } from "./contract/program-alert.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryProgramAlertStore, createSupabaseProgramAlertRepository } from "./index";

programAlertContract("in-memory fake", async () => {
  const store = createInMemoryProgramAlertStore();
  return {
    player: store.session("me"),
    other: store.session("other"),
    competitionSlug: "meeting-paris",
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  programAlertContract("Supabase (local)", async () => {
    const [player, other] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    // A competition of its own, without any event: its programme is not published.
    const { competitionSlug } = createTestCompetition({ open: 0 });
    return {
      player: createSupabaseProgramAlertRepository(player.client),
      other: createSupabaseProgramAlertRepository(other.client),
      competitionSlug,
    };
  });
} else {
  describe("Supabase program alert repository", () => {
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
