import type { EventGender } from "@/domain/event";
import { isValidStartList, type DisciplineFit } from "@/domain/start-list";

import { UseCaseError } from "./errors";

/** One athlete on a start list, as the admin types it. */
export type StartListEntry = { athleteId: string; seasonBest: string | null };

/** An athlete the admin can put on a start list. */
export type Candidate = {
  athleteId: string;
  name: string;
  countryCode: string;
  /** Whether the athlete runs the event's discipline, as their main one or not. */
  fit: DisciplineFit;
};

export type StartListOutcome = "saved" | "not_admin" | "athlete_in_use";

/** Port: start lists. Real adapter = Supabase (the admin's own session), fake = in memory. */
export interface StartListRepository {
  /** Every athlete of a gender, with how they fit the discipline, in any order. */
  candidates(gender: EventGender, discipline: string): Promise<Candidate[]>;
  /** The start list of an event, in any order; empty when not entered yet. */
  find(eventId: string): Promise<StartListEntry[]>;
  /**
   * Replaces the start list of an event in one go. An athlete already predicted or in the result
   * cannot be removed (`athlete_in_use`, nothing changes).
   */
  replace(eventId: string, entries: StartListEntry[]): Promise<StartListOutcome>;
  /** Adds an athlete unknown so far; the slug gets a suffix if already taken. */
  createAthlete(athlete: NewAthlete): Promise<{ athleteId: string } | "not_admin">;
  /**
   * Puts the athletes ranked `top` or better in a round on the start list of the round it leads
   * to; returns how many joined.
   */
  promote(eventId: string, top: number): Promise<number | "not_admin" | "no_next_round">;
}

/** An athlete the admin adds while importing a start list. */
export type NewAthlete = { name: string; countryCode: string; gender: EventGender; slug: string };

const CODES = { not_admin: "NOT_ADMIN", athlete_in_use: "START_LIST_IN_USE" } as const;

export function setStartList(ports: { startLists: StartListRepository }) {
  return {
    async execute(input: {
      eventId: string;
      entries: StartListEntry[];
    }): Promise<StartListEntry[]> {
      const entries = input.entries.map((e) => ({
        athleteId: e.athleteId,
        seasonBest: e.seasonBest?.trim() || null,
      }));
      if (!isValidStartList(entries)) throw new UseCaseError("START_LIST_INVALID");
      const outcome = await ports.startLists.replace(input.eventId, entries);
      if (outcome !== "saved") throw new UseCaseError(CODES[outcome]);
      return entries;
    },
  };
}
