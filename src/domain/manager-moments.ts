import type { Badge, BadgeLevel } from "./badges";
import type { Bib } from "./bib";
import { unpublished, type FeedMoment } from "./league-moments";

/**
 * The moments that do not come from score lines (#875): an athlete won at the reveal of a
 * mercato round, the result of a Manager duel, a badge level won. Each fact gets a stable key: the
 * same fact told twice is one moment.
 */

/** An athlete won at the close of a mercato round. */
export type MercatoWinFact = {
  round: number;
  athleteId: string;
  athlete: string;
  price: number;
  userId: string;
  pseudo: string;
  bib?: Bib;
  /** ISO 8601: when the round closed, that is when it was revealed. */
  closedAt: string;
};

export type DuelSide = { userId: string; pseudo: string; bib?: Bib; score: number };

/** A head-to-head whose matchday has its Manager scores. */
export type DuelFact = {
  round: number;
  home: DuelSide;
  away: DuelSide;
  competitionName?: string;
  /** ISO 8601: when the scores of the matchday were computed. */
  scoredAt: string;
};

/** What a Manager league tells: the facts of its mercato and duels, and the moments published. */
export type ManagerFacts = { wins: MercatoWinFact[]; duels: DuelFact[]; published: FeedMoment[] };

/** A badge level just won, to publish in the feed of each league of the player. */
export type BadgeMoment = {
  key: string;
  kind: "badge";
  userId: string;
  badge: Badge;
  level: BadgeLevel;
};

/** Keeps the first moment of each key. */
const oncePerKey = <T extends { key: string }>(moments: T[]): T[] => unpublished([], moments);

const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key);

/**
 * « Mercato »: who won which athletes at the reveal of a round, and for how much in all: one
 * moment per round and player (#979), each athlete once per round. The athletes are listed most
 * expensive first.
 */
export function mercatoMoments(wins: MercatoWinFact[]): FeedMoment[] {
  // Sorted first, so the same facts in any order keep the same athlete when one is told twice.
  const athletes = oncePerKey(
    wins
      .map((w) => ({ ...w, key: `${w.round}:${w.athleteId}` }))
      .sort((a, b) => byKey(a, b) || a.userId.localeCompare(b.userId)),
  );
  const moments = new Map<string, FeedMoment & { athletes: { name: string; price: number }[] }>();
  for (const w of athletes) {
    const key = `mercato_win:${w.round}:${w.userId}`;
    const moment = moments.get(key) ?? {
      key,
      kind: "mercato_win",
      happenedAt: w.closedAt,
      pseudo: w.pseudo,
      ...(w.bib ? { bib: w.bib } : {}),
      round: w.round,
      price: 0,
      athletes: [],
    };
    moment.price = (moment.price ?? 0) + w.price;
    moment.athletes.push({ name: w.athlete, price: w.price });
    moments.set(key, moment);
  }
  return [...moments.values()]
    .map((m) => ({
      ...m,
      athletes: m.athletes.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name)),
    }))
    .sort(byKey);
}

/**
 * « Duel »: the result of a head-to-head, winner first (a draw from the home side), once per
 * matchday and fixture. Scores computed again tell the latest ones.
 */
export function duelMoments(duels: DuelFact[]): FeedMoment[] {
  return oncePerKey(
    duels.map((d): FeedMoment => {
      const [first, second] = d.away.score > d.home.score ? [d.away, d.home] : [d.home, d.away];
      return {
        key: `duel_result:${d.round}:${d.home.userId}`,
        kind: "duel_result",
        happenedAt: d.scoredAt,
        pseudo: first.pseudo,
        ...(first.bib ? { bib: first.bib } : {}),
        otherPseudo: second.pseudo,
        ...(d.competitionName ? { competitionName: d.competitionName } : {}),
        scores: [first.score, second.score],
      };
    }),
  ).sort(byKey);
}

/** The feed of a Manager league: its mercato, its duels and the moments published, latest first. */
export function managerMoments(facts: ManagerFacts): FeedMoment[] {
  return oncePerKey([
    ...mercatoMoments(facts.wins),
    ...duelMoments(facts.duels),
    ...facts.published,
  ]).sort((a, b) => b.happenedAt.localeCompare(a.happenedAt) || byKey(a, b));
}

/** « Badge »: each level a player has just won, once per player, badge and level. */
export function badgeMoments(
  userId: string,
  raised: { badge: Badge; level: BadgeLevel }[],
): BadgeMoment[] {
  return oncePerKey(
    raised.map((r): BadgeMoment => ({
      key: `badge:${userId}:${r.badge}:${r.level}`,
      kind: "badge",
      userId,
      badge: r.badge,
      level: r.level,
    })),
  ).sort(byKey);
}
