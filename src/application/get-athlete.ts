import type { AthleteSheet } from "@/domain/athlete";

import { UseCaseError } from "./errors";

/** Port: athletes. Real adapter = Supabase (public data), fake = in memory. */
export interface AthleteReader {
  /** The athlete with their disciplines (main first), records and Manager price; null if unknown. */
  findBySlug(slug: string): Promise<AthleteSheet | null>;
}

export function getAthlete(ports: { athletes: AthleteReader }) {
  return {
    async execute(input: { slug: string }): Promise<AthleteSheet> {
      const athlete = await ports.athletes.findBySlug(input.slug);
      if (!athlete) throw new UseCaseError("ATHLETE_NOT_FOUND");
      return athlete;
    },
  };
}
