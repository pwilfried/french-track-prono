import type { ScoreReason } from "@/domain/scoring";

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
