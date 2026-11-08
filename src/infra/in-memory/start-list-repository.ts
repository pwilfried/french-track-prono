import type { Candidate, StartListEntry, StartListRepository } from "@/application/set-start-list";
import type { EventGender } from "@/domain/event";

/** An athlete the fake knows: gender and disciplines (the first is the main one). */
export type StartListAthleteFixture = Omit<Candidate, "fit"> & {
  gender: EventGender;
  disciplines?: string[];
};

/**
 * Test double of the StartListRepository port, with the rules of the database: only an admin
 * writes, and an athlete marked as in use (predicted, or in the result) cannot be removed. One
 * store shared by every session.
 */
export function createInMemoryStartListStore(athletes: StartListAthleteFixture[]) {
  const stored = new Map<string, StartListEntry[]>();
  const inUse = new Map<string, string[]>();
  return {
    /** Marks athletes of an event as predicted or ranked, so they cannot leave its start list. */
    markInUse(eventId: string, athleteIds: string[]) {
      inUse.set(eventId, athleteIds);
    },
    session(options: { isAdmin: boolean }): StartListRepository {
      return {
        async candidates(gender, discipline) {
          return athletes
            .filter((a) => a.gender === gender)
            .map(({ athleteId, name, countryCode, disciplines = [] }) => ({
              athleteId,
              name,
              countryCode,
              fit:
                disciplines[0] === discipline
                  ? ("primary" as const)
                  : disciplines.includes(discipline)
                    ? ("discipline" as const)
                    : ("other" as const),
            }));
        },
        async find(eventId) {
          return (stored.get(eventId) ?? []).map((e) => ({ ...e }));
        },
        async replace(eventId, entries) {
          if (!options.isAdmin) return "not_admin";
          const kept = entries.map((e) => e.athleteId);
          if ((inUse.get(eventId) ?? []).some((id) => !kept.includes(id))) return "athlete_in_use";
          stored.set(
            eventId,
            entries.map((e) => ({ ...e })),
          );
          return "saved";
        },
      };
    },
  };
}
