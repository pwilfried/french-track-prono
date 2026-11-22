"use client";

import type { MyLineup } from "@/application/manager-lineup";
import type { MyManagerJokers } from "@/application/manager-jokers";
import { MatchdayJokers, type JokerAthlete } from "@/components/manager/manager-jokers";
import { managerFamilyOf } from "@/domain/manager-rules";

import { coachManagerLineupAction, playManagerJokerAction } from "../../../joker-actions";

/**
 * « Ta carte de la journée » under the match sheet (#1091, #1121), wired to the database: the starters of
 * the sheet saved, the athletes of the team off it, the opponent's team for the false start.
 */
export function JokerPanel({
  leagueId,
  competitionId,
  slug,
  lineup,
  jokers,
}: {
  leagueId: string;
  competitionId: string;
  slug: string;
  lineup: Pick<MyLineup, "athletes" | "placed" | "plan" | "status">;
  jokers: MyManagerJokers;
}) {
  const team: JokerAthlete[] = lineup.athletes.map((a) => ({
    athleteId: a.athleteId,
    name: a.name,
    family: managerFamilyOf(a.family),
  }));
  const starterIds = new Set(lineup.placed.filter((id): id is string => id !== null));
  const onSheet = new Set([...starterIds, ...lineup.plan.bench]);
  const names = Object.fromEntries([
    ...team.map((a) => [a.athleteId, a.name] as const),
    ...(jokers.duel?.opponentTeam ?? []).map((a) => [a.athleteId, a.name] as const),
  ]);
  const matchday = { leagueId, competitionId, slug };
  const { opponent } = jokers;
  return (
    <MatchdayJokers
      duel={jokers.duel}
      locked={lineup.status === "locked"}
      hand={jokers.hand}
      mine={jokers.mine}
      opponent={
        opponent && {
          kind: opponent.kind,
          // Only the false start of the opponent aims at one of the player's athletes.
          athleteName:
            opponent.kind === "false_start" && opponent.athleteId
              ? (names[opponent.athleteId] ?? null)
              : null,
        }
      }
      starters={team.filter((a) => starterIds.has(a.athleteId))}
      offSheet={team.filter((a) => !onSheet.has(a.athleteId))}
      opponentTeam={jokers.duel?.opponentTeam ?? []}
      names={names}
      play={(kind, athleteId) => playManagerJokerAction({ ...matchday, kind, athleteId })}
      coach={(outId, inId) => coachManagerLineupAction({ ...matchday, outId, inId })}
    />
  );
}
