import { createClient } from "@supabase/supabase-js";
import { describe, it } from "vitest";

import { athleteReaderContract } from "./contract/athlete-reader.contract";
import { createInMemoryAthleteReader, createSupabaseAthleteReader } from "./index";

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
        disciplines: ["100 m", "200 m"],
        managerPrice: null,
        records: [
          {
            discipline: "100 m",
            kind: "pr",
            mark: "10.65",
            date: null,
            meeting: null,
            verified: false,
          },
        ],
      },
    ]),
  "sha-carri-richardson",
);

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  // A podium athlete of the seed: the records trigger gave her a PB in her main discipline.
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
