import { describe, expect, it } from "vitest";

import { findWikidataMatch, type WikidataSource } from "@/application/wikidata-link";
import { readWikidataAthlete } from "@/domain/wikidata-athlete";
import { iocCodeOf, itemIds } from "@/domain/wikidata-match";

/** Armand Duplantis and Sweden, known items of Wikidata that the fake holds too. */
export const DUPLANTIS = "Q20740797";
export const SWEDEN = "Q34";

/** Contract of the WikidataSource port (#1192), run against the fake AND Wikidata. */
export function wikidataSourceContract(name: string, source: () => WikidataSource) {
  // The real adapter sends a request a second at most, and waits when Wikidata lags.
  describe(`WikidataSource contract: ${name}`, { timeout: 60_000 }, () => {
    it("finds an athlete by name, within the limit", async () => {
      const ids = await source().search("Armand Duplantis", "en", 10);
      expect(ids).toContain(DUPLANTIS);
      expect(ids.length).toBeLessThanOrEqual(10);
    });

    it("reads an athlete and a country, leaving out an unknown id", async () => {
      const read = await source().getEntities([DUPLANTIS, "Q999999999999", SWEDEN]);
      expect(read.map((entity) => entity.id).sort()).toEqual([DUPLANTIS, SWEDEN].sort());
      const athlete = read.find((entity) => entity.id === DUPLANTIS)!;
      expect(itemIds(athlete, "P31")).toContain("Q5");
      expect(itemIds(athlete, "P1532")).toContain(SWEDEN);
      expect(readWikidataAthlete(athlete)).toMatchObject({
        birthDate: "1999-11-10",
        wikipediaUrl: "https://fr.wikipedia.org/wiki/Armand_Duplantis",
        disciplines: ["Saut à la perche"],
      });
      expect(iocCodeOf(read.find((entity) => entity.id === SWEDEN)!)).toBe("SWE");
    });

    it("links Duplantis on its own", async () => {
      const match = await findWikidataMatch({ wikidata: source() }).execute({
        name: "Armand Duplantis",
        countryCode: "SWE",
        gender: "M",
      });
      expect(match).toMatchObject({ status: "linked", id: DUPLANTIS });
    });
  });
}
