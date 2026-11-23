import type { WikidataSource } from "@/application/wikidata-link";
import { LABEL_LANGUAGES, nameKey, type WikidataEntity } from "@/domain/wikidata-match";

export type InMemoryWikidataSource = WikidataSource & {
  add(entity: WikidataEntity): void;
  /** Every search asked, in order, to check the English then French searches. */
  searches: { name: string; language: string; limit: number }[];
  /** The ids of every getEntities call, to check the batches. */
  reads: string[][];
};

/**
 * Test double of the WikidataSource port. A search finds the items whose label or alias in
 * English, French or mul starts with the name (accents and case ignored), like wbsearchentities.
 */
export function createInMemoryWikidataSource(
  fixtures: WikidataEntity[] = [],
): InMemoryWikidataSource {
  const entities = new Map(fixtures.map((entity) => [entity.id, entity]));
  const searches: InMemoryWikidataSource["searches"] = [];
  const reads: string[][] = [];
  const names = (entity: WikidataEntity) =>
    LABEL_LANGUAGES.flatMap((language) => [
      ...(entity.labels?.[language] ? [entity.labels[language].value] : []),
      ...(entity.aliases?.[language] ?? []).map((alias) => alias.value),
    ]);
  return {
    searches,
    reads,
    add(entity) {
      entities.set(entity.id, entity);
    },
    async search(name, language, limit) {
      searches.push({ name, language, limit });
      const key = nameKey(name);
      if (key === "") return [];
      return [...entities.values()]
        .filter((entity) => names(entity).some((n) => nameKey(n).startsWith(key)))
        .slice(0, limit)
        .map((entity) => entity.id);
    },
    async getEntities(ids) {
      reads.push(ids);
      return ids.flatMap((id) => entities.get(id) ?? []);
    },
  };
}
