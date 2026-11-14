import type { AthleteReader } from "@/application/get-athlete";
import type { AthleteSheet } from "@/domain/athlete";

/** Test double of the AthleteReader port, over a fixed list of athletes. */
export function createInMemoryAthleteReader(athletes: AthleteSheet[]): AthleteReader {
  return {
    async findBySlug(slug) {
      return athletes.find((a) => a.slug === slug) ?? null;
    },
  };
}
