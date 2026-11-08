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
  const entered = new Map<string, string[]>();
  const rounds = new Map<string, { next: string; ranked: { athleteId: string; rank: number }[] }>();
  return {
    /** Declares that a round leads to `next`, with its result. */
    setRound(eventId: string, next: string, ranked: { athleteId: string; rank: number }[]) {
      rounds.set(eventId, { next, ranked });
    },
    /** Enters athletes in the competition of an event: candidates are then only those, if one runs it. */
    enter(eventId: string, athleteIds: string[]) {
      entered.set(eventId, athleteIds);
    },
    /** Marks athletes of an event as predicted or ranked, so they cannot leave its start list. */
    markInUse(eventId: string, athleteIds: string[]) {
      inUse.set(eventId, athleteIds);
    },
    session(options: { isAdmin: boolean }): StartListRepository {
      return {
        async candidates(gender, discipline, eventId) {
          const all = athletes
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
          // Only the entered athletes, unless none of them runs the discipline (#326).
          const only = entered.get(eventId);
          const enteredOnes = only ? all.filter((c) => only.includes(c.athleteId)) : [];
          return enteredOnes.some((c) => c.fit !== "other") ? enteredOnes : all;
        },
        async find(eventId) {
          return (stored.get(eventId) ?? []).map((e) => ({ ...e }));
        },
        async createAthlete(athlete) {
          if (!options.isAdmin) return "not_admin";
          const athleteId = `new-${athletes.length + 1}`;
          athletes.push({
            athleteId,
            name: athlete.name,
            countryCode: athlete.countryCode,
            gender: athlete.gender,
          });
          return { athleteId };
        },
        async promote(eventId, top) {
          if (!options.isAdmin) return "not_admin";
          const round = rounds.get(eventId);
          if (!round) return "no_next_round";
          const list = stored.get(round.next) ?? [];
          const joining = round.ranked
            .filter((r) => r.rank <= top && !list.some((e) => e.athleteId === r.athleteId))
            .map((r) => ({ athleteId: r.athleteId, seasonBest: null }));
          stored.set(round.next, [...list, ...joining]);
          return joining.length;
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
