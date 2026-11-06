import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { EventSummary } from "@/domain/event";

import { eventReaderContract } from "./contract/event-reader.contract";
import { createInMemoryEventReader, createSupabaseEventReader } from "./index";

const COMPETITION = "ultimate-championship-2026";

const fixture: EventSummary[] = [
  {
    id: "e1",
    slug: "m-100m",
    discipline: "100 m",
    gender: "M",
    startsAt: "2026-09-12T17:00:00.000Z",
    lockAt: "2026-09-12T16:55:00.000Z",
    isFeatured: true,
    status: "finished",
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
  },
];

eventReaderContract(
  "in-memory fake",
  () => createInMemoryEventReader({ [COMPETITION]: fixture }),
  COMPETITION,
);

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  const supabaseReader = () => createSupabaseEventReader(createClient(url, key));

  eventReaderContract("Supabase (local)", supabaseReader, COMPETITION);

  describe("Supabase event reader on the seed", () => {
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
