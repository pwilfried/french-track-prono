import type { EventGender } from "@/domain/event";

import { getEventConsensus, type ConsensusRepository } from "./consensus";
import { listEvents, type EventReader } from "./list-events";

/**
 * The « La communauté » card of the home (#1080): what the players predicted on the last locked
 * final of a competition. Before the result, its favourite at 1st place; after, whether that
 * favourite won and the share of perfect podiums.
 */
export type CommunityTrend = {
  slug: string;
  discipline: string;
  gender: EventGender;
  /** How many players predicted it. */
  total: number;
  /** The most picked athlete at 1st place; `name` null when not on the start list (« Autre »). */
  favourite: { athleteId: string; name: string | null; percent: number };
  /** Null until the official result is in. */
  result: { favouriteWon: boolean; perfectPercent: number } | null;
};

/**
 * The trend of the last final locked at `now` in the competition, from `getEventConsensus`. Null
 * when no final is locked yet or nobody predicted it: the home then shows no card.
 */
export function getCommunityTrend(ports: { events: EventReader; consensus: ConsensusRepository }) {
  return {
    async execute(input: { competitionSlug: string; now: Date }): Promise<CommunityTrend | null> {
      const finals = await listEvents({ events: ports.events }).execute({
        competitionSlug: input.competitionSlug,
      });
      const last = finals
        .filter((e) => Date.parse(e.lockAt) <= input.now.getTime())
        .sort((a, b) => Date.parse(b.lockAt) - Date.parse(a.lockAt))[0];
      if (!last) return null;
      const event = await ports.events.findBySlug(input.competitionSlug, last.slug);
      if (!event) return null;

      const official = event.results.length > 0 ? event.results : undefined;
      const { consensus } = await getEventConsensus({ consensus: ports.consensus }).execute({
        eventId: event.id,
        leagueIds: [],
        official,
      });
      const favourite = consensus.places.first[0];
      if (!favourite) return null;

      const names = new Map(
        [...event.entries, ...event.results].map((a) => [a.athleteId, a.name] as const),
      );
      return {
        slug: event.slug,
        discipline: event.discipline,
        gender: event.gender,
        total: consensus.total,
        favourite: {
          athleteId: favourite.athleteId,
          name: names.get(favourite.athleteId) ?? null,
          percent: favourite.percent,
        },
        result: official
          ? {
              favouriteWon: official.some(
                (r) => r.rank === 1 && r.athleteId === favourite.athleteId,
              ),
              perfectPercent: consensus.perfect?.percent ?? 0,
            }
          : null,
      };
    },
  };
}
