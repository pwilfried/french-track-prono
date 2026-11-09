import type { ReadinessReader } from "@/application/competition-readiness";

/** Test double of the ReadinessReader port: start lists and odds marked by hand. */
export function createInMemoryReadinessStore() {
  const startLists = new Map<string, Set<string>>();
  const odds = new Map<string, Set<string>>();
  const mark = (store: Map<string, Set<string>>, slug: string, eventId: string) =>
    store.set(slug, (store.get(slug) ?? new Set()).add(eventId));
  return {
    addStartList: (slug: string, eventId: string) => mark(startLists, slug, eventId),
    addOdds: (slug: string, eventId: string) => mark(odds, slug, eventId),
    reader(): ReadinessReader {
      return {
        async readiness(slug) {
          return {
            withStartList: [...(startLists.get(slug) ?? [])],
            withOdds: [...(odds.get(slug) ?? [])],
          };
        },
      };
    },
  };
}
