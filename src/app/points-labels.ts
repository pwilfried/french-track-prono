import type { ScoreReason } from "@/domain/scoring";
import type { BreakdownLine, BreakdownRules } from "@/domain/event-result";

import { messages } from "./messages.fr";

const EXACT = { 1: "winner", 2: "second", 3: "third" } as const;

/**
 * Short French labels explaining a score, in reading order. A perfect podium is shown as one label
 * instead of three "found" ones; misplaced athletes are counted.
 */
export function pointsReasonLabels(reasons: ScoreReason[]): string[] {
  const text = messages.points.reasons;
  const perfect = reasons.some((r) => r.kind === "perfect_podium");
  const misplaced = reasons.filter((r) => r.kind === "on_podium").length;
  const labels: string[] = [];

  if (perfect) labels.push(text.perfect);
  else
    for (const reason of reasons)
      if (reason.kind === "exact") labels.push(text[EXACT[reason.slot]]);
  if (misplaced > 0) labels.push(text.misplaced(misplaced));
  if (reasons.some((r) => r.kind === "flair")) labels.push(text.flair);
  const sum = (kind: "odds" | "mark") =>
    reasons.reduce((total, r) => (r.kind === kind ? total + r.points : total), 0);
  if (sum("odds") > 0) labels.push(text.odds(sum("odds")));
  if (sum("mark") > 0) labels.push(text.marks(sum("mark")));
  if (labels.length === 0) labels.push(text.none);
  return labels;
}

/** The French label of one line of the detail of a score (#1155). */
export function breakdownLineLabel(line: BreakdownLine): string {
  const text = messages.breakdown;
  switch (line.kind) {
    case "exact":
      return text.exact[line.slot];
    case "on_podium":
      return text.misplaced(line.count);
    case "perfect_podium":
      return text.perfect;
    case "flair":
      return text.flair;
    case "odds":
      return text.odds;
    case "mark":
      return text.marks;
  }
}

/** The values of the scale the detail of a score needs, from the scale as stored. */
export function breakdownRules(scale: Record<string, number>): BreakdownRules {
  return {
    exactSlot: scale.exact_slot ?? 0,
    wrongPlace: scale.wrong_place ?? 0,
    perfectPodium: scale.perfect_podium ?? 0,
    flairBonus: scale.flair_bonus ?? 0,
  };
}
