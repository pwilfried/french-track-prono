import type { EventGender } from "@/domain/event";
import { pickHits, type PickHit } from "@/domain/prediction-history";

import type { PointsRepository } from "./compute-event-points";
import type { EventReader } from "./list-events";
import type { Prediction, PredictionRepository } from "./save-prediction";

export function listMyPredictions(ports: { predictions: PredictionRepository }) {
  return {
    async execute(input: { userId: string; competitionSlug: string }): Promise<Prediction[]> {
      return ports.predictions.listForCompetition(input.userId, input.competitionSlug);
    },
  };
}

/**
 * How many podiums the player has predicted in the competitions given: none makes a new player
 * (#476), exactly one shows « Ton premier podium est posé ! » (#540).
 */
export function countPredictions(ports: { predictions: PredictionRepository }) {
  return {
    async execute(input: { userId: string; competitionSlugs: string[] }): Promise<number> {
      const lists = await Promise.all(
        input.competitionSlugs.map((slug) =>
          ports.predictions.listForCompetition(input.userId, slug),
        ),
      );
      return lists.reduce((total, list) => total + list.length, 0);
    },
  };
}

/** One past or coming prediction, as the profile and « Tous mes pronos » show it (#387). */
export type MyPredictionLine = {
  competitionSlug: string;
  eventSlug: string;
  discipline: string;
  gender: EventGender;
  startsAt: string;
  /** 1st, 2nd, 3rd; a null name for « autre athlète » or an athlete no longer listed. */
  picks: { name: string | null; hit: PickHit }[];
  joker: boolean;
  /** Null until the points of the event are computed. */
  points: number | null;
};

/**
 * The player's predictions over the competitions given, the latest event first; `limit` keeps the
 * first ones only (the profile shows three). Athlete names are read for the lines kept only.
 */
export function getMyPredictionHistory(ports: {
  predictions: PredictionRepository;
  events: EventReader;
  points: Pick<PointsRepository, "listMine">;
}) {
  return {
    async execute(input: {
      userId: string;
      competitionSlugs: string[];
      limit?: number;
    }): Promise<MyPredictionLine[]> {
      const perCompetition = await Promise.all(
        input.competitionSlugs.map(async (slug) => {
          const [predictions, events, mine] = await Promise.all([
            ports.predictions.listForCompetition(input.userId, slug),
            ports.events.listByCompetition(slug),
            ports.points.listMine(input.userId, slug),
          ]);
          const eventOf = new Map(events.map((e) => [e.id, e]));
          const pointsOf = new Map(mine.map((l) => [l.eventId, l.points]));
          return predictions.flatMap((prediction) => {
            const event = eventOf.get(prediction.eventId);
            return event
              ? [{ slug, prediction, event, points: pointsOf.get(event.id) ?? null }]
              : [];
          });
        }),
      );
      const kept = perCompetition
        .flat()
        .sort(
          (a, b) =>
            Date.parse(b.event.startsAt) - Date.parse(a.event.startsAt) ||
            (a.event.slug < b.event.slug ? -1 : 1),
        )
        .slice(0, input.limit);

      return Promise.all(
        kept.map(async ({ slug, prediction, event, points }) => {
          const detail = await ports.events.findBySlug(slug, event.slug);
          const names = new Map(
            [...(detail?.entries ?? []), ...(detail?.results ?? [])].map((a) => [
              a.athleteId,
              a.name,
            ]),
          );
          const { podium } = prediction;
          const hits = pickHits(podium, detail?.results ?? []);
          return {
            competitionSlug: slug,
            eventSlug: event.slug,
            discipline: event.discipline,
            gender: event.gender,
            startsAt: event.startsAt,
            picks: [podium.first, podium.second, podium.third].map((id, i) => ({
              name: names.get(id) ?? null,
              hit: hits[i]!,
            })),
            joker: prediction.useJoker,
            points,
          };
        }),
      );
    },
  };
}
