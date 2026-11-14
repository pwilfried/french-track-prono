import { describe, expect, it } from "vitest";

import type { AthleteSheet } from "@/domain/athlete";

import { UseCaseError } from "./errors";
import { getAthlete, type AthleteReader } from "./get-athlete";

const reader = (athletes: AthleteSheet[]): AthleteReader => ({
  findBySlug: async (slug) => athletes.find((a) => a.slug === slug) ?? null,
  namesOf: async () => [],
});

const sheet: AthleteSheet = {
  athleteId: "a1",
  slug: "lea-fictive",
  name: "Léa Fictive",
  countryCode: "FRA",
  gender: "F",
  disciplines: ["100 m", "200 m"],
  managerPrice: 12,
  records: [
    {
      discipline: "100 m",
      kind: "pr",
      mark: "10.95",
      date: "2025-07-01",
      meeting: "Meeting",
      verified: false,
    },
  ],
};

describe("getAthlete", () => {
  it("gives the athlete's page with their disciplines, records and Manager price", async () => {
    // Given an athlete with a record
    const athletes = reader([sheet]);

    // When a fan opens their page
    const page = await getAthlete({ athletes }).execute({ slug: "lea-fictive" });

    // Then the page has everything the records need
    expect(page).toEqual(sheet);
  });

  it("refuses an unknown athlete with ATHLETE_NOT_FOUND", async () => {
    const athletes = reader([]);

    await expect(getAthlete({ athletes }).execute({ slug: "nobody" })).rejects.toEqual(
      new UseCaseError("ATHLETE_NOT_FOUND"),
    );
  });
});
