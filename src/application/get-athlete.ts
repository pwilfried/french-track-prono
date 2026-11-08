import type { AthleteSheet } from "@/domain/athlete";

import { UseCaseError } from "./errors";

/** How many recent races the athlete page shows. */
export const RECENT_RACES = 5;

/** Port: athletes. Real adapter = Supabase (public data), fake = in memory. */
export interface AthleteReader {
  /** The athlete with their records and their latest `races` results, newest first; null if unknown. */
  findBySlug(slug: string, races: number): Promise<AthleteSheet | null>;
}

export function getAthlete(ports: { athletes: AthleteReader }) {
  return {
    async execute(input: { slug: string }): Promise<AthleteSheet> {
      const athlete = await ports.athletes.findBySlug(input.slug, RECENT_RACES);
      if (!athlete) throw new UseCaseError("ATHLETE_NOT_FOUND");
      return athlete;
    },
  };
}
