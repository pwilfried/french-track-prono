import type { MarkUnit } from "@/domain/discipline";
import {
  missingPerformances,
  performanceProblem,
  tidyPerformances,
  type Performance,
  type PerformanceProblem,
} from "@/domain/performance";

import { UseCaseError, type ErrorCode } from "./errors";

export type PerformanceOutcome = "saved" | "not_admin" | "athlete_not_in_event";

/**
 * Port: the performances of every athlete of an event, for French Track Manager (#429). Real
 * adapter = Supabase (the admin's own session), fake = in memory.
 */
export interface PerformanceRepository {
  /** The performances of an event, in any order; empty when not entered yet. Everybody reads. */
  find(eventId: string): Promise<Performance[]>;
  /**
   * The athletes of the event's start list lined up in at least one Manager league for its
   * competition, in any order. Lineups are private: only an admin reads them.
   */
  linedUp(eventId: string): Promise<string[] | "not_admin">;
  /** Replaces every performance of an event in one go; only athletes of its start list. */
  replace(eventId: string, lines: Performance[]): Promise<PerformanceOutcome>;
}

const OUTCOMES = { not_admin: "NOT_ADMIN", athlete_not_in_event: "ATHLETE_NOT_IN_EVENT" } as const;

const PROBLEMS: Record<PerformanceProblem, ErrorCode> = {
  twice: "PERFORMANCES_INVALID",
  bad_place: "PERFORMANCES_INVALID",
  not_finished: "PERFORMANCES_INVALID",
  mark_missing: "PERFORMANCE_MARK_MISSING",
  bad_mark: "MARK_INVALID",
};

/**
 * The admin enters places, marks and records of the athletes of an event, or DNS, DNF, DQ. A new
 * entry replaces the previous one: a corrected result is entered again (#416).
 */
export function enterPerformances(ports: { performances: PerformanceRepository }) {
  return {
    async execute(input: {
      eventId: string;
      unit: MarkUnit;
      lines: Performance[];
    }): Promise<Performance[]> {
      const lines = tidyPerformances(input.lines, input.unit);
      const problem = performanceProblem(lines, input.unit);
      if (problem) throw new UseCaseError(PROBLEMS[problem]);
      const outcome = await ports.performances.replace(input.eventId, lines);
      if (outcome !== "saved") throw new UseCaseError(OUTCOMES[outcome]);
      return lines;
    },
  };
}

/** What the admin sees: the performances entered, who is lined up, and who is still missing. */
export function getPerformanceSheet(ports: { performances: PerformanceRepository }) {
  return {
    async execute(input: { eventId: string }): Promise<{
      performances: Performance[];
      linedUp: string[];
      missing: string[];
    }> {
      const linedUp = await ports.performances.linedUp(input.eventId);
      if (linedUp === "not_admin") throw new UseCaseError("NOT_ADMIN");
      const performances = await ports.performances.find(input.eventId);
      return { performances, linedUp, missing: missingPerformances(linedUp, performances) };
    },
  };
}
