import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ManagerScoreRepository, StoredManagerScore } from "@/application/manager-scores";
import type { MarkUnit } from "@/domain/discipline";
import { isManagerJoker, type ManagerJokerEffect } from "@/domain/manager-jokers";
import { MANAGER_BONUSES, type ManagerBonus, type ManagerFamily } from "@/domain/manager-rules";
import type { CompetitionPerformance, ScoringLineup } from "@/domain/manager-score";
import type { PerformanceStatus, RecordFlag } from "@/domain/performance";

import { athleteScoreOf, athleteScoreRow, type AthleteScoreRow } from "./manager-score-row";

type SubstituteRow = { athlete_id: string; family: ManagerFamily; discipline: string };
type LineupRow = {
  starters: (SubstituteRow & { substitute_id: string | null; threshold: number | null })[];
  bench: SubstituteRow[];
};

type SheetRow = {
  competition_id: string;
  lock_at: string;
  indoor: boolean;
  participants: {
    league_id: string;
    user_id: string;
    bonuses: Partial<Record<ManagerBonus, number>>;
    tables_divisor: number;
    lineup: LineupRow | null;
    joker?: {
      kind: string;
      athlete_id: string | null;
      family: ManagerFamily | null;
      discipline: string | null;
      replaced_id: string | null;
    } | null;
  }[];
  duels?: { league_id: string; home_id: string; away_id: string }[];
  performances: {
    athlete_id: string;
    discipline: string;
    gender: string;
    unit: MarkUnit;
    round: string;
    status: PerformanceStatus;
    place: number | null;
    mark: string | null;
    records: RecordFlag[];
  }[];
};

type JokerEffectRow = {
  kind: ManagerJokerEffect["kind"];
  by: ManagerJokerEffect["by"];
  athlete_id: string | null;
  points: number;
};

type ScoreRow = {
  lined_up: boolean;
  total: number;
  hungarian: number;
  bonus: number;
  athletes: (AthleteScoreRow & { name: string })[];
  jokers?: number;
  joker_effects?: (JokerEffectRow & { name?: string | null })[];
};

/** A league created before a bonus existed scores 0 for it. */
const bonusValues = (stored: Partial<Record<ManagerBonus, number>>) =>
  Object.fromEntries(MANAGER_BONUSES.map((b) => [b, Number(stored[b] ?? 0)])) as Record<
    ManagerBonus,
    number
  >;

const lineup = (row: LineupRow | null): ScoringLineup | null =>
  row && {
    starters: row.starters.map((s) => ({
      athleteId: s.athlete_id,
      family: s.family,
      discipline: s.discipline,
      substituteId: s.substitute_id,
      threshold: s.threshold === null ? null : Number(s.threshold),
    })),
    bench: row.bench.map((b) => ({
      athleteId: b.athlete_id,
      family: b.family,
      discipline: b.discipline,
    })),
  };

/** The admin reads the sheet and writes the scores with their own session; a participant reads theirs. */
export function createSupabaseManagerScoreRepository(
  client: SupabaseClient,
): ManagerScoreRepository {
  return {
    async sheet(competitionSlug) {
      const { data, error } = await client.rpc("admin_manager_scoring_sheet", {
        p_competition: competitionSlug,
      });
      if (error?.code === "42501") return "not_admin";
      if (error) throw new UseCaseError("MANAGER_SCORES_UNAVAILABLE");
      const sheet = data as SheetRow | null;
      if (!sheet) return null;
      return {
        competitionId: sheet.competition_id,
        lockAt: sheet.lock_at,
        indoor: sheet.indoor === true,
        participants: sheet.participants.map((p) => ({
          leagueId: p.league_id,
          userId: p.user_id,
          bonuses: bonusValues(p.bonuses),
          tablesDivisor: p.tables_divisor,
          lineup: lineup(p.lineup),
          joker:
            p.joker && isManagerJoker(p.joker.kind)
              ? {
                  kind: p.joker.kind,
                  athleteId: p.joker.athlete_id,
                  family: p.joker.family,
                  discipline: p.joker.discipline,
                  replacedId: p.joker.replaced_id,
                }
              : null,
        })),
        duels: (sheet.duels ?? []).map((d) => ({
          leagueId: d.league_id,
          homeId: d.home_id,
          awayId: d.away_id,
        })),
        performances: sheet.performances.map(
          (p): CompetitionPerformance => ({
            athleteId: p.athlete_id,
            discipline: p.discipline,
            sex: p.gender === "F" || p.gender === "M" ? p.gender : null,
            unit: p.unit,
            round: p.round,
            status: p.status,
            place: p.place,
            mark: p.mark,
            records: p.records,
          }),
        ),
      };
    },

    async replace(competitionId, lines) {
      const { error } = await client.rpc("admin_set_manager_scores", {
        p_competition: competitionId,
        p_lines: lines.map((l) => ({
          league_id: l.leagueId,
          user_id: l.userId,
          lined_up: l.linedUp,
          total: l.total,
          hungarian: l.hungarian,
          bonus: l.bonus,
          athletes: l.athletes.map(athleteScoreRow),
          jokers: l.jokers ?? 0,
          joker_effects: (l.jokerEffects ?? []).map(
            (e): JokerEffectRow => ({
              kind: e.kind,
              by: e.by,
              athlete_id: e.athleteId,
              points: e.points,
            }),
          ),
        })),
      });
      if (!error) return "saved";
      if (error.code === "42501") return "not_admin";
      throw new UseCaseError("MANAGER_SCORES_UNAVAILABLE");
    },

    async mine(leagueId, competitionId) {
      const { data, error } = await client.rpc("my_manager_score", {
        p_league: leagueId,
        p_competition: competitionId,
      });
      if (error?.code === "42501") return "not_member";
      if (error) throw new UseCaseError("MANAGER_SCORES_UNAVAILABLE");
      const row = ((data ?? []) as ScoreRow[])[0];
      if (!row) return null;
      return {
        linedUp: row.lined_up,
        total: row.total,
        hungarian: row.hungarian,
        bonus: row.bonus,
        athletes: row.athletes.map(
          (a): StoredManagerScore["athletes"][number] => ({ ...athleteScoreOf(a), name: a.name }),
        ),
        jokers: row.jokers ?? 0,
        jokerEffects: (row.joker_effects ?? []).map((e) => ({
          kind: e.kind,
          by: e.by,
          athleteId: e.athlete_id,
          points: e.points,
          name: e.name ?? null,
        })),
      };
    },
  };
}
