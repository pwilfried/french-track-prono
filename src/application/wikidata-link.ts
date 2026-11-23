import {
  countryIdsOf,
  iocCodeOf,
  matchWikidata,
  type AthleteToMatch,
  type WikidataEntity,
  type WikidataMatch,
} from "@/domain/wikidata-match";

/** Results of each search, in each language (docs/decisions/athletes-wikidata.md, section 6). */
export const WIKIDATA_SEARCH_LIMIT = 10;
/** The English search first, then the French one. */
export const WIKIDATA_SEARCH_LANGUAGES = ["en", "fr"] as const;

/**
 * Port: Wikidata, read only (#1192). Real adapter = the Wikidata API (wbsearchentities,
 * wbgetentities: serial, one request a second at most, maxlag), fake = in memory.
 */
export interface WikidataSource {
  /** Item ids whose label or alias matches the name, best first, at most `limit`. */
  search(name: string, language: string, limit: number): Promise<string[]>;
  /** The items, read by batches of 50; an unknown or deleted id is left out. */
  getEntities(ids: string[]): Promise<WikidataEntity[]>;
}

/**
 * Which item is our athlete: two searches (English, then French), the candidates read with
 * their countries, then the rule of the domain. Sure = saved on its own; else the admin chooses.
 */
export function findWikidataMatch(ports: { wikidata: WikidataSource }) {
  return {
    async execute(
      athlete: AthleteToMatch,
    ): Promise<WikidataMatch & { candidates: WikidataEntity[] }> {
      const ids: string[] = [];
      for (const language of WIKIDATA_SEARCH_LANGUAGES) {
        ids.push(...(await ports.wikidata.search(athlete.name, language, WIKIDATA_SEARCH_LIMIT)));
      }
      const read = async (wanted: string[]) =>
        wanted.length > 0 ? ports.wikidata.getEntities([...new Set(wanted)]) : [];
      const candidates = await read(ids);
      const countries = await read(candidates.flatMap(countryIdsOf));
      const iocCodes = new Map(
        countries.flatMap((country) => {
          const code = iocCodeOf(country);
          return code ? [[country.id, code] as const] : [];
        }),
      );
      const match = matchWikidata(athlete, candidates, iocCodes);
      const kept = match.status === "linked" ? [match.id] : match.candidateIds;
      return { ...match, candidates: candidates.filter((c) => kept.includes(c.id)) };
    },
  };
}
