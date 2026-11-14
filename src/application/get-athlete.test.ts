import { describe, expect, it } from "vitest";

import type { AthleteSheet } from "@/domain/athlete";

import { UseCaseError } from "./errors";
import { getAthlete, RECENT_RACES, type AthleteReader } from "./get-athlete";

const sheet: AthleteSheet = {
  athleteId: "a1",
  slug: "sha-carri-richardson",
  name: "Sha'Carri Richardson",
  countryCode: "USA",
  gender: "F",
  records: [],
  races: [],
};

describe("getAthlete", () => {
  it("returns the athlete page with the latest five races", async () => {
    const asked: number[] = [];
    const athletes: AthleteReader = {
      findBySlug: async (slug, races) => {
        asked.push(races);
        return slug === sheet.slug ? sheet : null;
      },
    };

    expect(await getAthlete({ athletes }).execute({ slug: sheet.slug })).toEqual(sheet);
    expect(asked).toEqual([RECENT_RACES]);
  });

  it("refuses an unknown athlete with ATHLETE_NOT_FOUND", async () => {
    const athletes: AthleteReader = { findBySlug: async () => null };

    await expect(getAthlete({ athletes }).execute({ slug: "nobody" })).rejects.toEqual(
      new UseCaseError("ATHLETE_NOT_FOUND"),
    );
  });
});
