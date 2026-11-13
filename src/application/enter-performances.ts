import { missingPerformances, type Performance } from "@/domain/performance";

import { UseCaseError } from "./errors";
import type { ManagerScoreRepository } from "./manager-scores";

export type PerformanceOutcome = "saved" | "not_admin" | "athlete_not_in_event";

/**
 * Port: the results sheet of an event (#429, #665), the performances of every athlete. Real adapter
 * = Supabase (the admin's own session), fake = in memory.
 */
export interface PerformanceRepository {
  /** The performances of an event, in any order; empty when not entered yet. Everybody reads. */
  find(eventId: string): Promise<Performance[]>;
  /**
   * The athletes of the event's start list lined up in at least one Manager league for its
   * competition, in any order. Lineups are private: only an admin reads them.
   */
  linedUp(eventId: string): Promise<string[] | "not_admin">;
  /**
   * Replaces every performance of an event in one go, only athletes of its start list, and the
   * official podium of the predictions with them: the finishers placed 1 to 3 (#665).
   */
  replace(eventId: string, lines: Performance[]): Promise<PerformanceOutcome>;
}

/**
 * What the admin sees on the results sheet: the performances entered, whether a Manager league
 * plays the competition, who is lined up and who is still missing. Without a Manager league the
 * podium is enough (#665).
 */
export function getPerformanceSheet(ports: {
  performances: PerformanceRepository;
  scores: ManagerScoreRepository;
}) {
  return {
    async execute(input: { eventId: string; competitionSlug: string | null }): Promise<{
      performances: Performance[];
      manager: boolean;
      linedUp: string[];
      missing: string[];
    }> {
      const linedUp = await ports.performances.linedUp(input.eventId);
      if (linedUp === "not_admin") throw new UseCaseError("NOT_ADMIN");
      const sheet = input.competitionSlug ? await ports.scores.sheet(input.competitionSlug) : null;
      if (sheet === "not_admin") throw new UseCaseError("NOT_ADMIN");
      const performances = await ports.performances.find(input.eventId);
      return {
        performances,
        manager: (sheet?.participants.length ?? 0) > 0,
        linedUp,
        missing: missingPerformances(linedUp, performances),
      };
    },
  };
}
