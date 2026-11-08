import type { AthleteReader } from "@/application/get-athlete";
import type { AthleteSheet } from "@/domain/athlete";

/** Test double of the AthleteReader port, over a fixed list of athletes. */
export function createInMemoryAthleteReader(athletes: AthleteSheet[]): AthleteReader {
  return {
    async findBySlug(slug, races) {
      const athlete = athletes.find((a) => a.slug === slug);
      if (!athlete) return null;
      return {
        ...athlete,
        races: athlete.races
          .filter((race) => race.startsAt <= new Date().toISOString())
          .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
          .slice(0, races),
      };
    },
  };
}
