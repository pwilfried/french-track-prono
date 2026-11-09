import { eventPhase } from "@/domain/countdown";

import type { EventReader } from "./list-events";

/**
 * Port: what the admin already entered for the events of a competition. Real adapter = Supabase
 * (start lists and odds are public), fake = in memory.
 */
export interface ReadinessReader {
  /** The ids of the competition's events with a start list, and with odds. */
  readiness(competitionSlug: string): Promise<{ withStartList: string[]; withOdds: string[] }>;
}

/** Where the next competition stands, finals only: players predict finals. */
export type CompetitionReadiness = {
  finals: number;
  withStartList: number;
  withOdds: number;
  /** Finals still open to predictions without odds. */
  openWithoutOdds: number;
};

export function getCompetitionReadiness(ports: {
  events: EventReader;
  readiness: ReadinessReader;
}) {
  return {
    async execute(input: { competitionSlug: string; now: Date }): Promise<CompetitionReadiness> {
      const [events, ready] = await Promise.all([
        ports.events.listByCompetition(input.competitionSlug),
        ports.readiness.readiness(input.competitionSlug),
      ]);
      const finals = events.filter((e) => e.round === "final");
      const startLists = new Set(ready.withStartList);
      const odds = new Set(ready.withOdds);
      return {
        finals: finals.length,
        withStartList: finals.filter((e) => startLists.has(e.id)).length,
        withOdds: finals.filter((e) => odds.has(e.id)).length,
        openWithoutOdds: finals.filter(
          (e) => !odds.has(e.id) && eventPhase(input.now, e.lockAt) === "open",
        ).length,
      };
    },
  };
}
