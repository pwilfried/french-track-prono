import type { ChallengeSummary, FrenchTrackRepository } from "@/application/frenchtrack";
import type { Bib } from "@/domain/bib";
import { challengeSeasonOf } from "@/domain/frenchtrack";
import type { Podium } from "@/domain/podium-draft";

/** An event the fake knows: its start list, and whether it is locked. */
export type FrenchTrackEventFixture = Omit<ChallengeSummary, "points" | "mine"> & {
  startList: string[];
  locked: boolean;
};

/**
 * Test double of the FrenchTrackRepository port: one store, a session per player. `score` stands
 * for the points of the players computed by the admin.
 */
export function createInMemoryFrenchTrackStore(
  events: FrenchTrackEventFixture[],
  players: Record<string, { pseudo: string; bib: Bib }> = {},
) {
  const picks = new Map<string, { podium: Podium; points: number | null }>();
  const scores = new Map<string, Map<string, number>>();
  const eventOf = (eventId: string) => events.find((e) => e.eventId === eventId);
  const yearOf = challengeSeasonOf;

  return {
    score(eventId: string, lines: Record<string, number>) {
      scores.set(eventId, new Map(Object.entries(lines)));
    },
    lock(eventId: string) {
      eventOf(eventId)!.locked = true;
    },
    session(options: { userId: string; isAdmin: boolean }): FrenchTrackRepository {
      const computed = (eventId: string) => {
        const pick = picks.get(eventId);
        return eventOf(eventId)?.locked && pick?.points != null ? pick.points : null;
      };
      const mineOn = (eventId: string) =>
        computed(eventId) === null ? null : (scores.get(eventId)?.get(options.userId) ?? null);

      return {
        async challenge(eventId) {
          const event = eventOf(eventId);
          const pick = picks.get(eventId);
          if (!event || !pick) return null;
          const points = computed(eventId);
          return {
            locked: event.locked,
            podium: event.locked || options.isAdmin ? { ...pick.podium } : null,
            points,
            mine: mineOn(eventId),
            scores:
              points === null
                ? []
                : [...(scores.get(eventId)?.values() ?? [])].sort((a, b) => a - b),
          };
        },
        async challenges(year) {
          return events
            .filter((e) => picks.has(e.eventId) && yearOf(e.startsAt) === year)
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
            .map((e) => ({
              eventId: e.eventId,
              slug: e.slug,
              discipline: e.discipline,
              gender: e.gender,
              startsAt: e.startsAt,
              lockAt: e.lockAt,
              points: computed(e.eventId),
              mine: mineOn(e.eventId),
            }));
        },
        async season(year) {
          return events
            .filter((e) => computed(e.eventId) !== null && yearOf(e.startsAt) === year)
            .flatMap((e) =>
              [...(scores.get(e.eventId) ?? new Map<string, number>())].map(([userId, points]) => ({
                eventId: e.eventId,
                userId,
                pseudo: players[userId]?.pseudo ?? userId,
                bib: players[userId]?.bib ?? { number: 1, color: "blue" as const },
                points,
                frenchTrackPoints: computed(e.eventId)!,
              })),
            );
        },
        async savePick(eventId, podium) {
          if (!options.isAdmin) return "not_admin";
          const event = eventOf(eventId);
          const picked = [podium.first, podium.second, podium.third];
          if (
            !event ||
            new Set(picked).size !== 3 ||
            picked.some((athleteId) => !event.startList.includes(athleteId))
          ) {
            return "invalid";
          }
          if (event.locked) return "locked";
          picks.set(eventId, { podium: { ...podium }, points: null });
          return "saved";
        },
        async removePick(eventId) {
          if (!options.isAdmin) return "not_admin";
          if (eventOf(eventId)?.locked) return "locked";
          picks.delete(eventId);
          return "removed";
        },
        async saveScore(eventId, points) {
          if (!options.isAdmin) return "not_admin";
          const pick = picks.get(eventId);
          if (pick) pick.points = points;
          return "saved";
        },
      };
    },
  };
}
