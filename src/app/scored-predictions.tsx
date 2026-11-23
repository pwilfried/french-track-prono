import type { LeagueResultLine } from "@/application/league-event-result";
import type { LeagueMember } from "@/application/leagues";
import {
  NoPredictionCard,
  ScoredPredictionCard,
  type ScoredDetail,
} from "@/components/reveal/scored-prediction-card";
import { pointsBreakdown, type BreakdownRules, type PredictionScore } from "@/domain/event-result";
import type { PredictionJoker } from "@/domain/league-jokers";
import { predictionVsOfficial } from "@/domain/podium";
import type { Podium } from "@/domain/podium-draft";

import { messages } from "./messages.fr";
import { breakdownLineLabel } from "./points-labels";

/** The detail of a score with its French labels (#1155); null while it is not computed. */
export function scoredDetail(
  score: PredictionScore | null,
  rules: BreakdownRules,
  joker: PredictionJoker | null,
): ScoredDetail | null {
  if (!score) return null;
  const detail = pointsBreakdown(score, rules, joker);
  return {
    lines: detail.lines.map((line) => ({ label: breakdownLineLabel(line), points: line.points })),
    subtotal: detail.subtotal,
    joker: detail.joker && {
      label: messages.breakdown.joker(
        messages.leagueJokers.emoji[detail.joker.joker],
        messages.leagueJokers.name[detail.joker.joker],
      ),
      points: detail.joker.points,
    },
    total: detail.total,
  };
}

/** The three picks of a podium, each marked against the official result. */
export function picksOf(
  podium: Podium,
  official: { athleteId: string; rank: number }[],
  nameOf: (athleteId: string) => string,
) {
  return predictionVsOfficial(podium, official).map((row) => ({
    slot: row.slot,
    name: nameOf(row.athleteId),
    outcome: row.outcome,
  }));
}

export const jokerChip = (joker: PredictionJoker | null) =>
  joker
    ? messages.breakdown.jokerChip(
        messages.leagueJokers.emoji[joker],
        messages.leagueJokers.name[joker],
      )
    : null;

/**
 * A league's predictions on an event once the result is in (#1155), ranked by points, each
 * unfolding its detail, then the members without one. Same cards in the league and on the event.
 * `extra`: what follows a card (its reactions on the event).
 */
export function ScoredPredictionList({
  lines,
  without = [],
  official,
  nameOf,
  rules,
  meId,
  group,
  extra,
}: {
  lines: LeagueResultLine[];
  without?: LeagueMember[];
  official: { athleteId: string; rank: number }[];
  nameOf: (athleteId: string) => string;
  rules: BreakdownRules;
  meId: string;
  group: string;
  extra?: (line: LeagueResultLine) => React.ReactNode;
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {lines.map((line) => (
        <ScoredPredictionCard
          key={line.predictionId}
          rank={line.rank}
          pseudo={line.pseudo}
          bib={line.bib}
          mine={line.userId === meId}
          joker={jokerChip(line.joker)}
          picks={picksOf(line.podium, official, nameOf)}
          detail={scoredDetail(line.score, rules, line.joker)}
          group={group}
        >
          {extra?.(line)}
        </ScoredPredictionCard>
      ))}
      {without.map((member) => (
        <NoPredictionCard
          key={member.userId}
          pseudo={member.pseudo}
          bib={member.bib}
          mine={member.userId === meId}
        />
      ))}
    </ul>
  );
}
