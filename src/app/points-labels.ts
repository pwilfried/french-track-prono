import type { ScoreReason } from "@/domain/scoring";

import { messages } from "./messages.fr";

const EXACT = { 1: "winner", 2: "second", 3: "third" } as const;

/**
 * Short French labels explaining a score, in reading order. A perfect podium is shown as one label
 * instead of three "found" ones; misplaced athletes are counted.
 */
export function pointsReasonLabels(reasons: ScoreReason[]): { text: string; joker: boolean }[] {
  const text = messages.points.reasons;
  const perfect = reasons.some((r) => r.kind === "perfect_podium");
  const misplaced = reasons.filter((r) => r.kind === "on_podium").length;
  const labels: { text: string; joker: boolean }[] = [];

  if (perfect) labels.push({ text: text.perfect, joker: false });
  else
    for (const reason of reasons)
      if (reason.kind === "exact") labels.push({ text: text[EXACT[reason.slot]], joker: false });
  if (misplaced > 0) labels.push({ text: text.misplaced(misplaced), joker: false });
  if (reasons.some((r) => r.kind === "flair")) labels.push({ text: text.flair, joker: false });
  const sum = (kind: "odds" | "mark") =>
    reasons.reduce((total, r) => (r.kind === kind ? total + r.points : total), 0);
  if (sum("odds") > 0) labels.push({ text: text.odds(sum("odds")), joker: false });
  if (sum("mark") > 0) labels.push({ text: text.marks(sum("mark")), joker: false });
  if (labels.length === 0) labels.push({ text: text.none, joker: false });
  if (reasons.some((r) => r.kind === "joker")) labels.push({ text: text.joker, joker: true });
  return labels;
}
