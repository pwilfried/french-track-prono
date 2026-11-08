import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { EventDetail } from "@/domain/event";

import { createTestCompetition, sql } from "./contract/database";
import { eventReaderContract } from "./contract/event-reader.contract";
import { createInMemoryEventReader, createSupabaseEventReader } from "./index";

const COMPETITION = "ultimate-championship-2026";

const fixture: EventDetail[] = [
  {
    id: "e1",
    slug: "m-100m",
    discipline: "100 m",
    gender: "M",
    startsAt: "2026-09-12T17:00:00.000Z",
    lockAt: "2026-09-12T16:55:00.000Z",
    isFeatured: true,
    status: "finished",
    entries: [{ athleteId: "a1", name: "A", countryCode: "FRA", seasonBest: null }],
    results: [{ athleteId: "a1", name: "A", countryCode: "FRA", rank: 1, mark: "9.80" }],
    subDisciplines: [],
  },
  {
    id: "e2",
    slug: "f-100m-hurdles",
    discipline: "100 m haies",
    gender: "F",
    startsAt: "2026-09-11T17:00:00.000Z",
    lockAt: "2026-09-11T16:55:00.000Z",
    isFeatured: false,
    status: "finished",
    entries: [{ athleteId: "a1", name: "A", countryCode: "FRA", seasonBest: null }],
    results: [{ athleteId: "a1", name: "A", countryCode: "FRA", rank: 1, mark: "9.80" }],
    subDisciplines: [],
  },
];

const HEPTATHLON = ["100 m haies", "Hauteur", "Poids", "200 m", "Longueur", "Javelot", "800 m"];

eventReaderContract(
  "in-memory fake",
  () =>
    createInMemoryEventReader({
      [COMPETITION]: fixture,
      "test-combined": [
        { ...fixture[1]!, id: "e3", slug: "f-heptathlon", subDisciplines: HEPTATHLON },
      ],
    }),
  COMPETITION,
  () => ({
    competitionSlug: "test-combined",
    eventSlug: "f-heptathlon",
    subDisciplines: HEPTATHLON,
  }),
);

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  const supabaseReader = () => createSupabaseEventReader(createClient(url, key));

  eventReaderContract("Supabase (local)", supabaseReader, COMPETITION, () => {
    // A heptathlon in a competition of its own, so that the seed counts stay the same.
    const { competitionSlug, events } = createTestCompetition({ open: 1 });
    const array = HEPTATHLON.map((d) => `'${d}'`).join(",");
    const eventSlug = sql(`update events set kind = 'combined', sub_disciplines = array[${array}]
      where id = '${events[0]!.eventId}' returning slug`);
    return { competitionSlug, eventSlug, subDisciplines: HEPTATHLON };
  });

  describe("Supabase event reader on the seed", () => {
    it("returns the official podium of the men's 100 m in rank order", async () => {
      const event = await supabaseReader().findBySlug(COMPETITION, "m-100m");

      expect(event?.entries.length).toBeGreaterThanOrEqual(3);
      expect(event?.results.map((r) => r.rank).slice(0, 3)).toEqual([1, 2, 3]);
    });

    it("returns the 28 events of the Ultimate Championship 2026", async () => {
      const events = await supabaseReader().listByCompetition(COMPETITION);

      expect(events).toHaveLength(28);
    });

    it("flags the 5 featured events", async () => {
      const events = await supabaseReader().listByCompetition(COMPETITION);

      expect(
        events
          .filter((e) => e.isFeatured)
          .map((e) => e.slug)
          .sort(),
      ).toEqual(["f-100m", "m-100m", "m-400m-hurdles", "m-5000m", "m-pole-vault"]);
    });
  });
} else {
  describe("Supabase event reader", () => {
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
