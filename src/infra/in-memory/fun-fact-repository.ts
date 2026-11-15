import { UseCaseError } from "@/application/errors";
import type { AdminFunFact, FunFactRepository } from "@/application/fun-facts";

/**
 * Test double of the FunFactRepository port, with the rules of the database: a player reads the
 * active facts without their source and the switch; only an admin reads every fact and writes;
 * a fact tied to an unknown competition or discipline is refused.
 */
export function createInMemoryFunFactStore(fixture: {
  admins: string[];
  competitions?: string[];
  disciplines?: string[];
  facts?: AdminFunFact[];
}) {
  let facts: AdminFunFact[] = structuredClone(fixture.facts ?? []);
  let enabled = true;
  return {
    session(userId: string): FunFactRepository {
      const admin = () => {
        if (!fixture.admins.includes(userId)) throw new UseCaseError("NOT_ADMIN");
      };
      return {
        async enabled() {
          return enabled;
        },
        async active() {
          return facts
            .filter((f) => f.active)
            .map((f) => ({
              id: f.id,
              title: f.title,
              body: f.body,
              tag: f.tag,
              competitionSlug: f.competitionSlug,
              discipline: f.discipline,
              startsOn: f.startsOn,
              endsOn: f.endsOn,
            }));
        },
        async all() {
          admin();
          return structuredClone(facts);
        },
        async save(id, fact) {
          admin();
          if (
            (fact.competitionSlug && !fixture.competitions?.includes(fact.competitionSlug)) ||
            (fact.discipline && !fixture.disciplines?.includes(fact.discipline))
          ) {
            throw new UseCaseError("FUN_FACT_TIE_INVALID");
          }
          const saved = { ...structuredClone(fact), id: id ?? crypto.randomUUID() };
          facts = id ? facts.map((f) => (f.id === id ? saved : f)) : [...facts, saved];
          return saved.id;
        },
        async remove(id) {
          admin();
          facts = facts.filter((f) => f.id !== id);
        },
        async setEnabled(value) {
          admin();
          enabled = value;
        },
      };
    },
  };
}
