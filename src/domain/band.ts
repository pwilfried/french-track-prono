import type { DisciplineFamily } from "./discipline";

/**
 * The band (#768): one animal per family of events, the hare as the mascot. In the order of the
 * band, the hare first.
 */
export const ANIMALS = [
  "lievre",
  "guepard",
  "impala",
  "kangourou",
  "chat",
  "ours",
  "renard",
] as const;
export type Animal = (typeof ANIMALS)[number];

/** The order the families are listed on the profile: sprint first, combined events last. */
export const BAND_ORDER: readonly Animal[] = [
  "guepard",
  "impala",
  "lievre",
  "kangourou",
  "chat",
  "ours",
  "renard",
];

const ANIMAL_OF: Record<DisciplineFamily, Animal | null> = {
  sprint: "guepard",
  hurdles: "impala",
  middle: "lievre",
  long: "lievre",
  horizontal_jumps: "kangourou",
  vertical_jumps: "chat",
  throws: "ours",
  combined: "renard",
  // Relays mix sprint and middle distance: they belong to no animal.
  relay: null,
};

/** The animal of a family of events; null for relays. */
export function animalOf(family: DisciplineFamily): Animal | null {
  return ANIMAL_OF[family];
}

/**
 * The animal an event card, an event page, a bib or a statuette wears (#800): the one of its
 * family, else the hare, the mascot (relays, or a discipline of unknown family).
 */
export function animalOrHare(family: DisciplineFamily | null | undefined): Animal {
  return (family && animalOf(family)) || "lievre";
}

/** A computed prediction of the season, as far as the band is concerned. */
export type BandLine = {
  family: DisciplineFamily | null;
  points: number;
  /** ISO 8601. */
  eventStartsAt: string;
};

/** The points of the season in one family of the band, and when the last ones came. */
export type BandPoints = { animal: Animal; points: number; lastScoredAt: number | null };

/** The season's points per animal, every animal of the band listed, sprint first. */
export function bandPoints(lines: readonly BandLine[]): BandPoints[] {
  const total = new Map<Animal, BandPoints>(
    BAND_ORDER.map((animal) => [animal, { animal, points: 0, lastScoredAt: null }]),
  );
  for (const line of lines) {
    const animal = line.family ? animalOf(line.family) : null;
    if (!animal || line.points <= 0) continue;
    const entry = total.get(animal)!;
    entry.points += line.points;
    const at = Date.parse(line.eventStartsAt);
    entry.lastScoredAt = Math.max(entry.lastScoredAt ?? at, at);
  }
  return BAND_ORDER.map((animal) => total.get(animal)!);
}

/** The families with points, the leader first: most points, then the most recent ones. */
function standings(lines: readonly BandLine[]): BandPoints[] {
  return bandPoints(lines)
    .filter((b) => b.points > 0)
    .sort(
      (a, b) =>
        b.points - a.points ||
        (b.lastScoredAt ?? 0) - (a.lastScoredAt ?? 0) ||
        BAND_ORDER.indexOf(a.animal) - BAND_ORDER.indexOf(b.animal),
    );
}

/**
 * The player's animal: the family where they scored the most points this season, a tie going to
 * the most recent points. Null before the first point in a family of the band.
 */
export function playerAnimal(lines: readonly BandLine[]): Animal | null {
  return standings(lines)[0]?.animal ?? null;
}

/**
 * The next animal the player can become: the runner-up, and the points it lacks. Being level is
 * enough to take over, since the most recent points break a tie.
 */
export function animalToReach(
  lines: readonly BandLine[],
): { animal: Animal; points: number } | null {
  const [leader, runnerUp] = standings(lines);
  if (!leader || !runnerUp) return null;
  return { animal: runnerUp.animal, points: Math.max(1, leader.points - runnerUp.points) };
}

/**
 * What to announce when the player opens their profile: their animal when it differs from the
 * last one they saw (`first` when they had none), nothing otherwise. Shown once: the caller then
 * remembers `current` as seen.
 */
export function animalChange(
  seen: Animal | null,
  current: Animal | null,
): { animal: Animal; first: boolean } | null {
  if (!current || current === seen) return null;
  return { animal: current, first: seen === null };
}
