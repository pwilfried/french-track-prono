import { describe, expect, it } from "vitest";

import type { CatalogueAthlete } from "@/domain/manager-catalogue";

import { UseCaseError } from "./errors";
import { browseManagerCatalogue, CATALOGUE_PAGE_SIZE } from "./manager-catalogue";

const athlete = (name: string, sex: "F" | "M" = "F"): CatalogueAthlete => ({
  athleteId: name,
  slug: name,
  name,
  countryCode: "FRA",
  sex,
  discipline: "100 m",
  family: "sprint",
  pb: null,
  sb: null,
  price: 10,
  available: true,
});

const noFilter = { sex: null, family: null, availableOnly: false };

describe("browseManagerCatalogue", () => {
  it("shows the men of the catalogue by name, a page at a time", async () => {
    const men = Array.from({ length: CATALOGUE_PAGE_SIZE + 1 }, (_, i) =>
      athlete(`Athlète ${String(i).padStart(2, "0")}`, "M"),
    );
    const catalogue = { list: async () => [athlete("Alice"), ...men.reverse()] };

    const view = await browseManagerCatalogue({ catalogue }).execute({
      leagueId: "l1",
      query: "",
      filter: { ...noFilter, sex: "M" },
      page: 2,
    });

    expect(view.total).toBe(CATALOGUE_PAGE_SIZE + 1);
    expect(view.rows.map((a) => a.name)).toEqual([`Athlète ${CATALOGUE_PAGE_SIZE}`]);
  });

  it("answers LEAGUE_NOT_FOUND to a player who is not in the league", async () => {
    const catalogue = { list: async () => "not_member" as const };

    await expect(
      browseManagerCatalogue({ catalogue }).execute({
        leagueId: "l1",
        query: "",
        filter: noFilter,
        page: 1,
      }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});
