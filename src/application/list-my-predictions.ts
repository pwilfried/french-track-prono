import { eventPhase } from "@/domain/countdown";
import type { EventGender } from "@/domain/event";
import { OTHER_ATHLETE } from "@/domain/podium-draft";
import { pickHits, type PickHit } from "@/domain/prediction-history";

import type { PointsRepository } from "./compute-event-points";
import type { AthleteName, AthleteReader } from "./get-athlete";
import type { EventReader } from "./list-events";
import type { Prediction, PredictionRepository } from "./save-prediction";

export function listMyPredictions(ports: { predictions: PredictionRepository }) {
  return {
    async execute(input: { userId: string; competitionSlug: string }): Promise<Prediction[]> {
      return ports.predictions.listForCompetition(input.userId, input.competitionSlug);
    },
  };
}

/** The other event of the competition where my joker is played (#981). */
export type JokerElsewhere = {
  eventSlug: string;
  discipline: string;
  gender: EventGender;
  /** Its event is still open: removing the joker there frees it for another event. */
  movable: boolean;
};

/** Where my joker of the competition is played, when it is on another event than this one. */
export function findMyJokerElsewhere(ports: {
  predictions: PredictionRepository;
  events: Pick<EventReader, "listByCompetition">;
}) {
  return {
    async execute(input: {
      userId: string;
      competitionSlug: string;
      eventId: string;
      now: Date;
    }): Promise<JokerElsewhere | null> {
      const mine = await ports.predictions.listForCompetition(input.userId, input.competitionSlug);
      const joker = mine.find((p) => p.useJoker && p.eventId !== input.eventId);
      if (!joker) return null;
      const events = await ports.events.listByCompetition(input.competitionSlug);
      const event = events.find((e) => e.id === joker.eventId);
      if (!event) return null;
      return {
        eventSlug: event.slug,
        discipline: event.discipline,
        gender: event.gender,
        movable: eventPhase(input.now, event.lockAt) === "open",
      };
    },
  };
}

/** What a scored podium got right: athletes in their place, on the podium, all three. */
export type PodiumHits = { exact: number; onPodium: number; perfect: boolean };

/**
 * My mark on one event of the list: predicted, with or without the joker, the points won with
 * what the podium got right, null until computed, and my podium, 1st to 3rd (#800); null for
 * « autre athlète » or an athlete no longer listed.
 */
export type MyEventMark = {
  eventId: string;
  joker: boolean;
  points: number | null;
  hits: PodiumHits | null;
  podium: (AthleteName | null)[];
};

/** My predictions in a competition with their points, null until computed (#488). */
export function listMyEventMarks(ports: {
  predictions: PredictionRepository;
  points: Pick<PointsRepository, "listMine">;
  athletes: Pick<AthleteReader, "namesOf">;
}) {
  return {
    async execute(input: { userId: string; competitionSlug: string }): Promise<MyEventMark[]> {
      const [mine, scores] = await Promise.all([
        ports.predictions.listForCompetition(input.userId, input.competitionSlug),
        ports.points.listMine(input.userId, input.competitionSlug),
      ]);
      const lineOf = new Map(scores.map((l) => [l.eventId, l]));
      // Every athlete of my podiums, read in one go.
      const ids = new Set(
        mine.flatMap(({ podium }) => [podium.first, podium.second, podium.third]),
      );
      ids.delete(OTHER_ATHLETE);
      const nameOf = new Map(
        (ids.size > 0 ? await ports.athletes.namesOf([...ids]) : []).map((a) => [a.athleteId, a]),
      );
      return mine.map((p) => {
        const line = lineOf.get(p.eventId);
        const count = (kind: string) => line?.reasons.filter((r) => r.kind === kind).length ?? 0;
        return {
          eventId: p.eventId,
          joker: p.useJoker,
          points: line?.points ?? null,
          hits: line
            ? {
                exact: count("exact"),
                onPodium: count("on_podium"),
                perfect: count("perfect_podium") > 0,
              }
            : null,
          podium: [p.podium.first, p.podium.second, p.podium.third].map(
            (id) => nameOf.get(id) ?? null,
          ),
        };
      });
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
