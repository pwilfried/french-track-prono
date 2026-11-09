import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { readinessContract } from "./contract/readiness-reader.contract";
import {
  createInMemoryReadinessStore,
  createPublicSupabaseClient,
  createSupabaseReadinessReader,
} from "./index";

readinessContract("in-memory fake", async () => {
  const store = createInMemoryReadinessStore();
  const slug = `ready-${crypto.randomUUID().slice(0, 8)}`;
  return {
    reader: store.reader(),
    competition: { slug, events: ["e1", "e2"] },
    async addStartList(eventId) {
      store.addStartList(slug, eventId);
    },
    async addOdds(eventId) {
      store.addOdds(slug, eventId);
    },
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  readinessContract("Supabase (local)", async () => {
    const tag = crypto.randomUUID().slice(0, 8);
    const slug = `ready-${tag}`;
    sql(`insert into competitions (slug, name, starts_on, ends_on)
         values ('${slug}', 'Prêt ${tag}', current_date + 300, current_date + 301)`);
    const ids = sql(`with ins as (
        insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
        select c.id, '${slug}-' || n, '100 m', 'F', now() + interval '300 days', now() + interval '300 days'
        from competitions c, (values ('a'), ('b')) v(n) where c.slug = '${slug}'
        returning id
      ) select string_agg(id::text, ',') from ins`).split(",");
    const athlete = sql(`insert into athletes (slug, name, country_code, gender)
      values ('ready-${tag}', 'Prête ${tag}', 'FRA', 'F') returning id`);
    return {
      reader: createSupabaseReadinessReader(createPublicSupabaseClient()),
      competition: { slug, events: [ids[0]!, ids[1]!] },
      async addStartList(eventId) {
        sql(`insert into entries (event_id, athlete_id) values ('${eventId}', '${athlete}')`);
      },
      async addOdds(eventId) {
        sql(
          `insert into event_odds (event_id, athlete_id, odds) values ('${eventId}', '${athlete}', 3.5)`,
        );
      },
    };
  });
} else {
  describe("Supabase readiness reader", () => {
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
