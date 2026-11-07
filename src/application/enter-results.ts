import { isValidOfficialPodium } from "@/domain/official-result";

import { UseCaseError } from "./errors";

/** One line of an official result, as the admin types it. */
export type ResultEntry = { athleteId: string; rank: number; mark: string | null };

export type ResultOutcome = "saved" | "not_admin" | "athlete_not_in_event";

/** Port: official results. Real adapter = Supabase (the admin's own session), fake = in memory. */
export interface ResultRepository {
  /** The official result of an event, best rank first; empty when not entered yet. */
  find(eventId: string): Promise<ResultEntry[]>;
  /** Replaces the whole result of an event, in one go. */
  replace(eventId: string, lines: ResultEntry[]): Promise<ResultOutcome>;
}

const CODES = { not_admin: "NOT_ADMIN", athlete_not_in_event: "ATHLETE_NOT_IN_EVENT" } as const;

export function enterResults(ports: { results: ResultRepository }) {
  return {
    async execute(input: { eventId: string; lines: ResultEntry[] }): Promise<ResultEntry[]> {
      const lines = input.lines.map((line) => ({ ...line, mark: line.mark?.trim() || null }));
      if (!isValidOfficialPodium(lines)) throw new UseCaseError("RESULT_INVALID");
      const outcome = await ports.results.replace(input.eventId, lines);
      if (outcome !== "saved") throw new UseCaseError(CODES[outcome]);
      return lines;
    },
  };
}
