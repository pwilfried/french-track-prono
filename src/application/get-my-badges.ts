import {
  badgeProgress,
  raisedBadges,
  type Badge,
  type BadgeLevel,
  type BadgeProgress,
  type StoredLevels,
} from "@/domain/badges";
import type { DisciplineFamily } from "@/domain/discipline";
import { groupEventsByDay } from "@/domain/event-list";
import { badgeMoments, type BadgeMoment } from "@/domain/manager-moments";

import type { DisciplineRepository } from "./disciplines";
import type { EventReader } from "./list-events";
import type { RankingRepository } from "./rankings";
import type { PredictionRepository } from "./save-prediction";

/**
 * Port: the badge levels a player has won and been shown (#821). Real adapter = Supabase, fake =
 * in memory. A level is never lowered, never removed.
 */
export interface BadgeLevelRepository {
  levels(userId: string): Promise<StoredLevels>;
  /** Raises each badge to the level given; a lower level than the stored one is ignored. */
  raise(userId: string, levels: { badge: Badge; level: BadgeLevel }[]): Promise<void>;
  /**
   * Tells the levels the signed-in player holds in the feed of each of their leagues, prediction
   * and Manager (#875); a fact already told, or a level not held, is left out. Returns how many
   * moments are new.
   */
  publishMoments(moments: BadgeMoment[]): Promise<number>;
}

type Ports = {
  ranking: RankingRepository;
  predictions: PredictionRepository;
  events: EventReader;
  disciplines: Pick<DisciplineRepository, "list">;
  levels: BadgeLevelRepository;
};

type Input = { userId: string; competitionSlugs: string[] };

/** The badges of the profile, and the levels won since the last ones shown (to celebrate). */
export type MyBadges = {
  progress: BadgeProgress[];
  raised: { badge: Badge; level: BadgeLevel }[];
};

/** Where the player stands on each badge over the season (rules in src/domain/badges.ts). */
async function readBadges(ports: Ports, input: Input): Promise<MyBadges> {
  const slugs = input.competitionSlugs;
  const [lines, predictions, events, disciplines, stored] = await Promise.all([
    Promise.all(slugs.map((s) => ports.ranking.competitionLines(s))),
    Promise.all(slugs.map((s) => ports.predictions.listForCompetition(input.userId, s))),
    Promise.all(slugs.map((s) => ports.events.listByCompetition(s))),
    ports.disciplines.list(),
    ports.levels.levels(input.userId),
  ]);
  const all = lines.flat();
  const myPredictions = predictions.flat();
  const myLines = all.filter((l) => l.userId === input.userId);
  const computed = new Map(
    all.filter((l) => l.eventId !== "").map((l) => [l.eventId, l.eventStartsAt]),
  );
  const familyOf = new Map<string, DisciplineFamily>(disciplines.map((d) => [d.name, d.family]));
  const eventOf = new Map(
    events.flatMap((list, i) => list.map((e) => [e.id, { ...e, competitionSlug: slugs[i] }])),
  );

  // A French winner found: read the start list of the few events where the winner was right.
  const pickOf = new Map(myPredictions.map((p) => [p.eventId, p.podium.first]));
  const won = myLines.filter((l) => l.reasons.some((r) => r.kind === "exact" && r.slot === 1));
  const french = await Promise.all(
    won.map(async (l) => {
      const event = eventOf.get(l.eventId);
      const detail = event
        ? await ports.events.findBySlug(event.competitionSlug, event.slug)
        : null;
      const pick = detail?.entries.find((e) => e.athleteId === pickOf.get(l.eventId));
      return pick?.countryCode === "FRA" ? l.eventId : null;
    }),
  );

  // Players predict finals only: heats never count for the "every event of a day" badge.
  const days = events.flatMap((list) =>
    groupEventsByDay(
      list
        .filter((e) => e.round === "final")
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    ).map((d) => d.events.map((e) => e.id)),
  );

  const progress = badgeProgress(
    {
      myLines: myLines.map((l) => {
        const event = eventOf.get(l.eventId);
        return { ...l, family: event ? (familyOf.get(event.discipline) ?? null) : null };
      }),
      computedEvents: [...computed].map(([eventId, startsAt]) => ({ eventId, startsAt })),
      frenchWinnerEvents: new Set(french.filter((id): id is string => id !== null)),
      days,
      predictedEventIds: new Set(myPredictions.map((p) => p.eventId)),
    },
    stored,
  );
  return { progress, raised: raisedBadges(progress, stored) };
}

/** The profile's badges. Reading never writes: a new level stays to celebrate until it is seen. */
export function getMyBadges(ports: Ports) {
  return {
    execute: (input: Input): Promise<MyBadges> => readBadges(ports, input),
  };
}

/**
 * The player has seen the celebration: the levels won are stored, so it is shown once and never
 * lost, then told in the feeds of their leagues (#875). The levels are counted again here, never
 * taken from the browser.
 */
export function markBadgesSeen(ports: Ports) {
  return {
    async execute(input: Input): Promise<void> {
      const { raised } = await readBadges(ports, input);
      if (raised.length === 0) return;
      await ports.levels.raise(input.userId, raised);
      await ports.levels.publishMoments(badgeMoments(input.userId, raised));
    },
  };
}
