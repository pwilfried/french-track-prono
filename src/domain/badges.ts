import type { DisciplineFamily } from "./discipline";
import type { ScoreReason } from "./scoring";

/**
 * Badges and their levels: rules in docs/decisions/badges-et-trophees.md (#807, #821). Game badges
 * (the hare's) count a way of playing; family badges count the points won in a family of events.
 */
export const GAME_BADGES = [
  "nostradamus",
  "chasseur",
  "flair",
  "serie",
  "bleus",
  "fidele",
] as const;
export const FAMILY_BADGES = [
  "foudre",
  "haies",
  "train",
  "bond",
  "envol",
  "force",
  "touche",
] as const;
/** Every badge, in display order. */
export const BADGES = [...GAME_BADGES, ...FAMILY_BADGES] as const;
export type Badge = (typeof BADGES)[number];
export type FamilyBadge = (typeof FAMILY_BADGES)[number];

/** A badge is won in bronze, then silver, then gold, over the season. */
export const BADGE_LEVELS = ["bronze", "silver", "gold"] as const;
export type BadgeLevel = (typeof BADGE_LEVELS)[number];

/** The families of each family badge; relays have none. */
export const BADGE_FAMILIES: Record<FamilyBadge, DisciplineFamily[]> = {
  foudre: ["sprint"],
  haies: ["hurdles"],
  train: ["middle", "long"],
  bond: ["horizontal_jumps"],
  envol: ["vertical_jumps"],
  force: ["throws"],
  touche: ["combined"],
};

/** Points won in the family over the season, for bronze, silver and gold. */
const FAMILY_THRESHOLDS = [50, 150, 400] as const;

/** What a badge needs for bronze, silver and gold. */
export const BADGE_THRESHOLDS: Record<Badge, readonly [number, number, number]> = {
  nostradamus: [1, 3, 10],
  chasseur: [3, 10, 30],
  flair: [1, 3, 10],
  serie: [5, 10, 20],
  bleus: [1, 5, 15],
  fidele: [1, 5, 15],
  ...(Object.fromEntries(FAMILY_BADGES.map((b) => [b, FAMILY_THRESHOLDS])) as Record<
    FamilyBadge,
    readonly [number, number, number]
  >),
};

export type BadgeInput = {
  /** The player's own score lines over the season; `family` is null for a bonus line. */
  myLines: {
    eventId: string;
    eventStartsAt: string;
    points: number;
    reasons: ScoreReason[];
    family: DisciplineFamily | null;
  }[];
  /** Every computed event of the season (any player has points on it). */
  computedEvents: { eventId: string; startsAt: string }[];
  /** Events where the player's winner pick was right and is French. */
  frenchWinnerEvents: Set<string>;
  /** The season's events grouped by competition day. */
  days: string[][];
  /** Events the player predicted. */
  predictedEventIds: Set<string>;
};

/** The levels already won (and shown) by a player; a badge missing has none. */
export type StoredLevels = Partial<Record<Badge, BadgeLevel>>;

/**
 * Where a player stands on a badge: their level (null before bronze), what they count this season,
 * and the threshold of the next level (the gold one once gold).
 */
export type BadgeProgress = {
  badge: Badge;
  level: BadgeLevel | null;
  current: number;
  target: number;
};

const rank = (level: BadgeLevel | null | undefined) => (level ? BADGE_LEVELS.indexOf(level) : -1);

/**
 * Nostradamus: perfect podiums. Chasseur: winners found. Flair: coups de flair. Série: the best run
 * of computed events in a row with at least 1 point. Bleus: French winners found. Fidèle: days with
 * a prediction on every event. Family badges: points won in the family.
 */
export function badgeCounts(input: BadgeInput): Record<Badge, number> {
  const count = (has: (r: ScoreReason) => boolean) =>
    input.myLines.filter((l) => l.reasons.some(has)).length;

  const scored = new Set(input.myLines.filter((l) => l.points > 0).map((l) => l.eventId));
  const order = [...input.computedEvents].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || (a.eventId < b.eventId ? -1 : 1),
  );
  let run = 0;
  let best = 0;
  for (const e of order) {
    run = scored.has(e.eventId) ? run + 1 : 0;
    best = Math.max(best, run);
  }

  const familyPoints = (families: DisciplineFamily[]) =>
    input.myLines
      .filter((l) => l.family !== null && families.includes(l.family))
      .reduce((sum, l) => sum + l.points, 0);

  return {
    nostradamus: count((r) => r.kind === "perfect_podium"),
    chasseur: count((r) => r.kind === "exact" && r.slot === 1),
    flair: count((r) => r.kind === "flair"),
    serie: best,
    bleus: input.frenchWinnerEvents.size,
    fidele: input.days.filter(
      (day) => day.length > 0 && day.every((id) => input.predictedEventIds.has(id)),
    ).length,
    ...(Object.fromEntries(
      FAMILY_BADGES.map((b) => [b, familyPoints(BADGE_FAMILIES[b])]),
    ) as Record<FamilyBadge, number>),
  };
}

/** The level a count reaches on a badge; null below bronze. */
export function levelOf(badge: Badge, count: number): BadgeLevel | null {
  const reached = BADGE_THRESHOLDS[badge].filter((threshold) => count >= threshold).length;
  return reached === 0 ? null : BADGE_LEVELS[reached - 1];
}

/**
 * Every badge in display order. A badge is never lost: its level is the higher of the one counted
 * this season and the one already stored.
 */
export function badgeProgress(input: BadgeInput, stored: StoredLevels = {}): BadgeProgress[] {
  const counts = badgeCounts(input);
  return BADGES.map((badge) => progressOf(badge, counts[badge], stored[badge]));
}

/** Where a count puts a badge, never below the level already stored. */
export function progressOf(badge: Badge, count: number, stored?: BadgeLevel): BadgeProgress {
  const counted = levelOf(badge, count);
  const level = rank(stored) > rank(counted) ? stored! : counted;
  return {
    badge,
    level,
    current: count,
    target: BADGE_THRESHOLDS[badge][Math.min(rank(level) + 1, 2)],
  };
}

/** The level after this one: bronze before any, null after gold. */
export function nextLevel(level: BadgeLevel | null): BadgeLevel | null {
  return level === "gold" ? null : BADGE_LEVELS[rank(level) + 1];
}

/** A badge is earned from bronze on. */
export function isEarned(progress: BadgeProgress): boolean {
  return progress.level !== null;
}

/** The badges whose level is above the one stored: the level just won, to celebrate once. */
export function raisedBadges(
  progress: BadgeProgress[],
  stored: StoredLevels,
): { badge: Badge; level: BadgeLevel }[] {
  return progress.flatMap((p) =>
    p.level && rank(p.level) > rank(stored[p.badge]) ? [{ badge: p.badge, level: p.level }] : [],
  );
}

/**
 * From the easiest badge to the hardest, to break ties in `nextBadge` (#768): a day fully predicted
 * is within reach of anyone, a perfect podium is not. Family badges follow, in display order.
 */
const EASIEST_FIRST: Badge[] = [
  "fidele",
  "chasseur",
  "serie",
  "bleus",
  "flair",
  "nostradamus",
  ...FAMILY_BADGES,
];

/**
 * The badge with the smallest effort left to its next level: the share of the threshold still to
 * go, so 10 points out of 50 come before 1 winner out of 3. The easiest badge breaks ties; null
 * once every badge is gold.
 */
export function nextBadge(
  progress: BadgeProgress[],
): (BadgeProgress & { left: number; next: BadgeLevel }) | null {
  return (
    progress
      .flatMap((p) => {
        const next = nextLevel(p.level);
        return next ? [{ ...p, left: Math.max(p.target - p.current, 1), next }] : [];
      })
      .sort(
        (a, b) =>
          a.left / a.target - b.left / b.target ||
          EASIEST_FIRST.indexOf(a.badge) - EASIEST_FIRST.indexOf(b.badge),
      )[0] ?? null
  );
}
