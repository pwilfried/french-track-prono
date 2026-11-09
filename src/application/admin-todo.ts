import { eventPhase } from "@/domain/countdown";

import type { ClubAdminRepository } from "./club-admin";
import type { PointsRepository } from "./compute-event-points";
import type { LeagueModerationRepository } from "./league-moderation";
import type { EventReader } from "./list-events";

export type AdminTodoPorts = {
  events: EventReader;
  points: Pick<PointsRepository, "progress">;
  clubs: ClubAdminRepository;
  moderation: LeagueModerationRepository;
};

/** What waits for the admin in each section; null when that section could not be read. */
export type AdminTodo = { results: number | null; clubs: number | null; leagues: number | null };

async function orNull<T>(read: () => Promise<T | "not_admin">, count: (value: T) => number) {
  try {
    const value = await read();
    return value === "not_admin" ? null : count(value);
  } catch {
    return null;
  }
}

/** The counters of the back-office menu: results to enter, clubs to validate, reported leagues. */
export function getAdminTodo(ports: AdminTodoPorts) {
  return {
    async execute(input: { competitionSlug: string; now: Date }): Promise<AdminTodo> {
      const [results, clubs, leagues] = await Promise.all([
        orNull(
          async () => {
            const [events, progress] = await Promise.all([
              ports.events.listByCompetition(input.competitionSlug),
              ports.points.progress(input.competitionSlug),
            ]);
            return { events, withResult: new Set(progress.withResult) };
          },
          ({ events, withResult }) =>
            events.filter(
              (e) => eventPhase(input.now, e.lockAt) === "locked" && !withResult.has(e.id),
            ).length,
        ),
        orNull(
          () => ports.clubs.list("", true),
          (list) => list.length,
        ),
        orNull(
          () => ports.moderation.list(),
          (list) => list.filter((league) => league.reportCount > 0).length,
        ),
      ]);
      return { results, clubs, leagues };
    },
  };
}
