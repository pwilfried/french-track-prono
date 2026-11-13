import { badgeProgress, type BadgeProgress } from "@/domain/badges";
import { groupEventsByDay } from "@/domain/event-list";

import type { EventReader } from "./list-events";
import type { RankingRepository } from "./rankings";
import type { PredictionRepository } from "./save-prediction";

/** Every badge of a competition, earned or not, with the progress towards it (src/domain/badges.ts). */
export function getMyBadges(ports: {
  ranking: RankingRepository;
  predictions: PredictionRepository;
  events: EventReader;
}) {
  return {
    async execute(input: {
      userId: string;
      competitionSlug: string;
      timeZone: string;
    }): Promise<BadgeProgress[]> {
      const [lines, predictions, events] = await Promise.all([
        ports.ranking.competitionLines(input.competitionSlug),
        ports.predictions.listForCompetition(input.userId, input.competitionSlug),
        ports.events.listByCompetition(input.competitionSlug),
      ]);
      // Players predict finals only: heats never count for the "every event of a day" badge.
      const finals = events.filter((e) => e.round === "final");
      const myLines = lines.filter((l) => l.userId === input.userId);
      const computed = new Map(lines.map((l) => [l.eventId, l.eventStartsAt]));
      const sorted = [...finals].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

      // A French winner found: read the start list of the few events where the winner was right.
      const pickOf = new Map(predictions.map((p) => [p.eventId, p.podium.first]));
      const slugOf = new Map(events.map((e) => [e.id, e.slug]));
      const won = myLines.filter((l) => l.reasons.some((r) => r.kind === "exact" && r.slot === 1));
      const french = await Promise.all(
        won.map(async (l) => {
          const slug = slugOf.get(l.eventId);
          const detail = slug ? await ports.events.findBySlug(input.competitionSlug, slug) : null;
          const pick = detail?.entries.find((e) => e.athleteId === pickOf.get(l.eventId));
          return pick?.countryCode === "FRA" ? l.eventId : null;
        }),
      );

      return badgeProgress({
        myLines,
        computedEvents: [...computed].map(([eventId, startsAt]) => ({ eventId, startsAt })),
        frenchWinnerEvents: new Set(french.filter((id): id is string => id !== null)),
        days: groupEventsByDay(sorted, input.timeZone).map((d) => d.events.map((e) => e.id)),
        predictedEventIds: new Set(predictions.map((p) => p.eventId)),
      });
    },
  };
}
