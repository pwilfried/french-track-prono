import { createClient } from "@supabase/supabase-js";
import { describe, it } from "vitest";

import { athleteReaderContract } from "./contract/athlete-reader.contract";
import { createInMemoryAthleteReader, createSupabaseAthleteReader } from "./index";

const race = (startsAt: string, rank: number) => ({
  competitionSlug: "c",
  eventSlug: "f-100m",
  discipline: "100 m",
  startsAt,
  meeting: "Meeting",
  rank,
  mark: "10.80",
});

athleteReaderContract(
  "in-memory fake",
  () =>
    createInMemoryAthleteReader([
      {
        athleteId: "a1",
        slug: "sha-carri-richardson",
        name: "Sha'Carri Richardson",
        countryCode: "USA",
        gender: "F",
        records: [{ discipline: "100 m", kind: "pr", mark: "10.65", date: null, meeting: null }],
        races: [race("2026-06-01T18:00:00.000Z", 2), race("2026-09-12T18:00:00.000Z", 3)],
      },
    ]),
  "sha-carri-richardson",
);

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  // A podium athlete of the seed: the records trigger gave her a PR.
  athleteReaderContract(
    "Supabase (local)",
    () => createSupabaseAthleteReader(createClient(url, key)),
    "sha-carri-richardson",
  );
} else {
  describe("Supabase athlete reader", () => {
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
