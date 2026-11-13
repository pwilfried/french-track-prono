import type { ManagerBonus } from "./manager-rules";

/** The record bonuses; the admin flags them when entering a result. */
export type ManagerRecord = Exclude<ManagerBonus, "first" | "second" | "third">;

/** What an athlete did in an event: a place (none for DNS, DNF, DQ) and the records flagged. */
export type ManagerBonusResult = { place: number | null; records: ManagerRecord[] };

const PLACE_BONUSES: Record<number, ManagerBonus> = { 1: "first", 2: "second", 3: "third" };

/**
 * The sporting bonuses of an athlete in an event, with the values frozen in the league rules.
 * Every bonus adds up: a win with a personal best earns both (docs/decisions/french-track-manager.md).
 */
export function managerBonusPoints(
  result: ManagerBonusResult,
  bonuses: Record<ManagerBonus, number>,
): number {
  const earned = new Set<ManagerBonus>(result.records);
  const placeBonus = result.place === null ? undefined : PLACE_BONUSES[result.place];
  if (placeBonus) earned.add(placeBonus);
  return [...earned].reduce((sum, b) => sum + bonuses[b], 0);
}
