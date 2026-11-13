import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { createManagerLeagueAs } from "./contract/manager-competitions";
import { managerCatalogueContract } from "./contract/manager-catalogue.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryManagerCatalogue, createSupabaseManagerCatalogue } from "./index";

managerCatalogueContract("in-memory fake", async () => {
  const store = createInMemoryManagerCatalogue(
    [
      {
        athleteId: "a1",
        slug: "a1",
        name: "Athlète Une",
        countryCode: "FRA",
        sex: "F",
        discipline: "100 m",
        family: "sprint",
        pb: "11.01",
        sb: null,
        price: 17,
        available: true,
      },
    ],
    { l1: ["u1"] },
  );
  return {
    leagueId: "l1",
    participant: store.session("u1"),
    outsider: store.session("u2"),
    athleteId: "a1",
    restore: async () => {},
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  managerCatalogueContract("Supabase (local)", async () => {
    const [participant, outsider] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    const leagueId = await createManagerLeagueAs(participant.client, "Catalogue");
    const athleteId = sql(`select a.id from athletes a
      join athlete_disciplines ad on ad.athlete_id = a.id and ad.is_primary
      join disciplines d on d.name = ad.discipline
      where a.kind = 'athlete' and a.gender in ('F', 'M') and d.family <> 'relay'
      order by a.slug limit 1`);
    const before = sql(
      `select coalesce(manager_price::text, 'null') from athletes where id = '${athleteId}'`,
    );
    sql(`update athletes set manager_price = 17 where id = '${athleteId}'`);
    return {
      leagueId,
      participant: createSupabaseManagerCatalogue(participant.client),
      outsider: createSupabaseManagerCatalogue(outsider.client),
      athleteId,
      restore: async () =>
        void sql(`update athletes set manager_price = ${before} where id = '${athleteId}'`),
    };
  });
} else {
  describe("Supabase Manager catalogue", () => {
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
