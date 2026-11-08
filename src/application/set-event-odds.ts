import { isValidOdds, type EventOdds } from "@/domain/odds";

import { UseCaseError } from "./errors";

/** The PR and SB of an athlete in the event's discipline, to help set the odds. */
export type AthleteMarks = { athleteId: string; pr: string | null; sb: string | null };

/** Port: odds. Real adapter = Supabase (admin session for writes), fake = in memory. */
export interface OddsRepository {
  /** The odds of an event; null when not set yet. */
  find(eventId: string): Promise<EventOdds | null>;
  /** The PR and SB in the event's discipline of the athletes on its start list. */
  marks(eventId: string): Promise<AthleteMarks[]>;
  /** Replaces the odds; refused once the event is locked. */
  save(eventId: string, odds: EventOdds): Promise<"saved" | "not_admin" | "locked" | "invalid">;
}

const CODES = { not_admin: "NOT_ADMIN", locked: "ODDS_LOCKED", invalid: "ODDS_INVALID" } as const;

/** The admin sets the odds of an event: 5 or 6 athletes of the start list and another athlete. */
export function setEventOdds(ports: { odds: OddsRepository }) {
  return {
    async execute(input: { eventId: string; startList: string[]; odds: EventOdds }) {
      if (!isValidOdds(input.odds, input.startList)) throw new UseCaseError("ODDS_INVALID");
      const outcome = await ports.odds.save(input.eventId, input.odds);
      if (outcome !== "saved") throw new UseCaseError(CODES[outcome]);
    },
  };
}

/** What the odds page shows: the current odds and the athletes' PR and SB. */
export function getEventOdds(ports: { odds: OddsRepository }) {
  return {
    async execute(input: { eventId: string }) {
      const [odds, marks] = await Promise.all([
        ports.odds.find(input.eventId),
        ports.odds.marks(input.eventId),
      ]);
      return { odds, marks: new Map(marks.map((m) => [m.athleteId, m])) };
    },
  };
}
