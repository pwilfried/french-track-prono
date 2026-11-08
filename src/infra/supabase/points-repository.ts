import type { SupabaseClient } from "@supabase/supabase-js";

import type { PointsRepository, ScoreLine } from "@/application/compute-event-points";
import { UseCaseError } from "@/application/errors";
import { parseMark, type MarkUnit } from "@/domain/discipline";
import type { EventOdds } from "@/domain/odds";
import type { ScoreReason, ScoringRules } from "@/domain/scoring";

import { slotFromRow } from "./podium-slot";

type PredictionRow = {
  user_id: string;
  p1: string | null;
  p2: string | null;
  p3: string | null;
  use_joker: boolean;
  m1: number | string | null;
  m2: number | string | null;
  m3: number | string | null;
};

const num = (value: number | string | null) => (value === null ? null : Number(value));
type ScoreRow = {
  user_id: string;
  event_id: string;
  points: number;
  detail: { reasons?: ScoreReason[] };
};

const RULE_KEYS: Record<string, keyof ScoringRules> = {
  exact_slot: "exactSlot",
  wrong_place: "wrongPlace",
  perfect_podium: "perfectPodium",
  flair_bonus: "flairBonus",
  flair_threshold: "flairThreshold",
  flair_min_players: "flairMinPlayers",
  joker_multiplier: "jokerMultiplier",
  odds_exact: "oddsExact",
  odds_one_off: "oddsOneOff",
  odds_two_off: "oddsTwoOff",
  mark_exact: "markExact",
  mark_near: "markNear",
};

/** The client must carry the admin's session: row level security decides who can write. */
export function createSupabasePointsRepository(client: SupabaseClient): PointsRepository {
  const fail = (): never => {
    throw new UseCaseError("POINTS_UNAVAILABLE");
  };

  return {
    async loadEvent(eventId) {
      const event = await client
        .from("events")
        .select("lock_at, competitions!inner(odds_enabled), disciplines(unit, tolerance)")
        .eq("id", eventId)
        .maybeSingle<{
          lock_at: string;
          competitions: { odds_enabled: boolean };
          disciplines: { unit: MarkUnit; tolerance: number | string } | null;
        }>();
      if (event.error) fail();
      if (!event.data) return null;

      const [results, predictions, rules, odds] = await Promise.all([
        client
          .from("results")
          .select("athlete_id, rank, mark")
          .eq("event_id", eventId)
          .returns<{ athlete_id: string; rank: number; mark: string | null }[]>(),
        client
          .from("predictions")
          .select("user_id, p1, p2, p3, use_joker, m1, m2, m3")
          .eq("event_id", eventId)
          .returns<PredictionRow[]>(),
        client.from("scoring_rules").select("key, value").returns<{ key: string; value: number | string }[]>(),
        client
          .from("event_odds")
          .select("athlete_id, odds")
          .eq("event_id", eventId)
          .returns<{ athlete_id: string | null; odds: number | string }[]>(),
      ]);
      if (results.error || predictions.error || rules.error || odds.error) fail();
      const unit = event.data.disciplines?.unit;
      const other = odds.data!.find((o) => o.athlete_id === null);
      const eventOdds: EventOdds | null =
        event.data.competitions.odds_enabled && other
          ? {
              proposed: odds.data!.flatMap((o) =>
                o.athlete_id ? [{ athleteId: o.athlete_id, odds: Number(o.odds) }] : [],
              ),
              other: Number(other.odds),
            }
          : null;

      const scoring = {} as ScoringRules;
      for (const row of rules.data!) {
        const name = RULE_KEYS[row.key];
        if (name) scoring[name] = Number(row.value);
      }
      if (Object.keys(scoring).length !== Object.keys(RULE_KEYS).length) fail();

      return {
        lockAt: new Date(event.data.lock_at).toISOString(),
        results: results.data!.map((r) => {
          const markValue = r.mark && unit ? parseMark(r.mark, unit) : null;
          return { athleteId: r.athlete_id, rank: r.rank, ...(markValue !== null ? { markValue } : {}) };
        }),
        predictions: predictions.data!.map((p) => ({
          userId: p.user_id,
          first: slotFromRow(p.p1),
          second: slotFromRow(p.p2),
          third: slotFromRow(p.p3),
          useJoker: p.use_joker,
          ...(p.m1 !== null || p.m2 !== null || p.m3 !== null
            ? { marks: { first: num(p.m1), second: num(p.m2), third: num(p.m3) } }
            : {}),
        })),
        rules: scoring,
        bets: {
          odds: eventOdds,
          tolerance: event.data.disciplines ? Number(event.data.disciplines.tolerance) : null,
        },
      };
    },

    async findEventScores(eventId) {
      const { data, error } = await client
        .from("score_events")
        .select("user_id, points, detail")
        .eq("event_id", eventId)
        .eq("source", "prediction")
        .returns<ScoreRow[]>();
      if (error) fail();
      return data!.map(
        (row): ScoreLine => ({ userId: row.user_id, points: row.points, reasons: row.detail.reasons ?? [] }),
      );
    },

    async progress(competitionSlug) {
      // `results` only references `entries`, so the competition's events are read first.
      const events = await client
        .from("events")
        .select("id, competitions!inner(slug)")
        .eq("competitions.slug", competitionSlug)
        .returns<{ id: string }[]>();
      if (events.error) fail();
      const ids = events.data!.map((e) => e.id);
      if (ids.length === 0) return { withResult: [], scored: [] };
      const [results, scores] = await Promise.all([
        client.from("results").select("event_id").in("event_id", ids).returns<{ event_id: string }[]>(),
        client
          .from("score_events")
          .select("event_id")
          .eq("source", "prediction")
          .in("event_id", ids)
          .returns<{ event_id: string }[]>(),
      ]);
      if (results.error || scores.error) fail();
      const unique = (rows: { event_id: string }[]) => [...new Set(rows.map((r) => r.event_id))];
      return { withResult: unique(results.data!), scored: unique(scores.data!) };
    },

    async listMine(userId, competitionSlug) {
      const { data, error } = await client
        .from("score_events")
        .select("user_id, event_id, points, detail, events!inner(competitions!inner(slug))")
        .eq("user_id", userId)
        .eq("source", "prediction")
        .eq("events.competitions.slug", competitionSlug)
        .returns<ScoreRow[]>();
      if (error) fail();
      return data!.map((row) => ({
        userId: row.user_id,
        eventId: row.event_id,
        points: row.points,
        reasons: row.detail.reasons ?? [],
      }));
    },

    async replaceEventScores(eventId, lines) {
      const { error } = await client.rpc("set_event_scores", {
        p_event: eventId,
        p_lines: lines.map((l) => ({ user_id: l.userId, points: l.points, detail: { reasons: l.reasons } })),
      });
      if (!error) return "saved";
      // 42501: the session is not an admin's.
      if (error.code === "42501") return "not_admin";
      return fail();
    },
  };
}
