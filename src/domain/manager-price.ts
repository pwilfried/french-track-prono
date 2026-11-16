import { parseMark, type Discipline } from "./discipline";
import type { EventGender } from "./event";
import { worldAthleticsPoints } from "./world-athletics-points";

/** How fit an athlete is for the season (#1028): fit by default. */
export type AthleteCondition = "fit" | "doubtful" | "out";
export const ATHLETE_CONDITIONS: AthleteCondition[] = ["fit", "doubtful", "out"];

/** How often an athlete runs in French competitions (#1028): sometimes by default. */
export type FrancePresence = "often" | "sometimes" | "rarely";
export const FRANCE_PRESENCES: FrancePresence[] = ["often", "sometimes", "rarely"];

/** How the back-office suggests a Manager price (part of the Manager rules, #1028). */
export type ManagerPricing = {
  /** From the most points down: the price of the first step the mark reaches. */
  grid: { minPoints: number; price: number }[];
  /** Share taken off a personal best older than 12 months (0.05: a time × 1.05, a length × 0.95). */
  oldMarkPenalty: number;
  /** Price factor of a doubtful athlete or one out for the season. */
  unfitFactor: number;
  /** Price factor of an athlete rarely seen in France. */
  rarelyFactor: number;
};

/** What the suggestion reads from the athlete page. */
export type PriceInput = {
  sex: EventGender;
  /** The main discipline; null when the athlete has none. */
  discipline: Discipline | null;
  /** The PB and SB of the main discipline. */
  records: { kind: "pr" | "sb"; mark: string; date: string | null }[];
  condition: AthleteCondition;
  presence: FrancePresence;
  /** YYYY-MM-DD. */
  today: string;
};

export type PriceSuggestion = {
  price: number;
  /** The mark as typed on the page. */
  mark: string;
  /** World Athletics points of the mark, after the 5 % of an old PB. */
  points: number;
  /** A mark of the last 12 months, or an older personal best degraded. */
  basis: "recent" | "old_pb";
};

/** The same day, a year earlier: a mark dated after it is less than 12 months old. */
const yearBefore = (day: string) => `${Number(day.slice(0, 4)) - 1}${day.slice(4)}`;

/**
 * The price the back-office suggests for an athlete (#1028): the best mark of the last 12 months
 * in the main discipline, else the PB degraded, turned into World Athletics points, then into a
 * price by the grid; halved for a doubtful athlete, × the « rarely in France » factor, rounded,
 * never under 1. Null without a mark or a scoring table: the admin prices the athlete alone.
 */
export function suggestManagerPrice(
  athlete: PriceInput,
  pricing: ManagerPricing,
): PriceSuggestion | null {
  const { discipline, sex } = athlete;
  if (!discipline || (sex !== "F" && sex !== "M")) return null;
  const points = (value: number) => worldAthleticsPoints(discipline.name, sex, value);
  const parsed = athlete.records.flatMap((r) => {
    const value = parseMark(r.mark, discipline.unit);
    return value === null ? [] : [{ ...r, value }];
  });

  const since = yearBefore(athlete.today);
  let best: Omit<PriceSuggestion, "price"> | null = null;
  for (const record of parsed) {
    if (!record.date || record.date <= since) continue;
    const scored = points(record.value);
    if (scored === null) return null;
    if (!best || scored > best.points)
      best = { mark: record.mark, points: scored, basis: "recent" };
  }
  if (!best) {
    const pb = parsed.find((r) => r.kind === "pr");
    if (!pb) return null;
    const penalty = discipline.lowerIsBetter
      ? 1 + pricing.oldMarkPenalty
      : 1 - pricing.oldMarkPenalty;
    const scored = points(pb.value * penalty);
    if (scored === null) return null;
    best = { mark: pb.mark, points: scored, basis: "old_pb" };
  }

  const reached = best.points;
  const step = pricing.grid.find((s) => reached >= s.minPoints);
  if (!step) return null;
  let price = step.price;
  if (athlete.condition !== "fit") price *= pricing.unfitFactor;
  if (athlete.presence === "rarely") price *= pricing.rarelyFactor;
  return { ...best, price: Math.max(1, Math.round(price)) };
}

const isFactor = (n: number) => Number.isFinite(n) && n > 0 && n <= 1;

/** A pricing the admin can save: steps from the most points down, whole prices, sane factors. */
export function isValidManagerPricing(pricing: ManagerPricing): boolean {
  const { grid } = pricing;
  return (
    grid.length > 0 &&
    grid.every(
      (s, i) =>
        Number.isFinite(s.minPoints) &&
        s.minPoints >= 0 &&
        Number.isInteger(s.price) &&
        s.price > 0 &&
        (i === 0 || s.minPoints < grid[i - 1].minPoints),
    ) &&
    Number.isFinite(pricing.oldMarkPenalty) &&
    pricing.oldMarkPenalty >= 0 &&
    pricing.oldMarkPenalty < 1 &&
    isFactor(pricing.unfitFactor) &&
    isFactor(pricing.rarelyFactor)
  );
}
