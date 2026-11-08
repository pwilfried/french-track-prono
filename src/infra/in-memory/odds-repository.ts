import type { AthleteMarks, OddsRepository } from "@/application/set-event-odds";
import { isValidOdds, type EventOdds } from "@/domain/odds";

/** An event the fake knows: its start list, lock state and the athletes' PR/SB. */
export type OddsEventFixture = {
  eventId: string;
  startList: string[];
  locked: boolean;
  marks: AthleteMarks[];
};

/** Test double of the OddsRepository port: one store, a session per player. */
export function createInMemoryOddsStore(events: OddsEventFixture[]) {
  const stored = new Map<string, EventOdds>();
  return {
    session(options: { isAdmin: boolean }): OddsRepository {
      return {
        async find(eventId) {
          const odds = stored.get(eventId);
          return odds
            ? { proposed: [...odds.proposed].sort((a, b) => a.odds - b.odds), other: odds.other }
            : null;
        },
        async marks(eventId) {
          return events.find((e) => e.eventId === eventId)?.marks.map((m) => ({ ...m })) ?? [];
        },
        async save(eventId, odds) {
          if (!options.isAdmin) return "not_admin";
          const event = events.find((e) => e.eventId === eventId);
          if (!event || !isValidOdds(odds, event.startList)) return "invalid";
          if (event.locked) return "locked";
          stored.set(eventId, structuredClone(odds));
          return "saved";
        },
      };
    },
  };
}
