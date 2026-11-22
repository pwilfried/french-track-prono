import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ManagerJokerOutcome, ManagerJokerRepository } from "@/application/manager-jokers";
import { isManagerJoker } from "@/domain/manager-jokers";

/** What the RPCs of the Manager jokers raise, as outcomes (#1091). */
const OUTCOMES: Record<string, ManagerJokerOutcome> = {
  FT023: "locked",
  FT045: "not_available",
  FT048: "no_duel",
  FT049: "away",
  FT050: "bad_target",
  FT051: "no_coaching",
  "42501": "not_member",
  // An id that is not a uuid: no such league or athlete.
  "22P02": "not_member",
};

type PlayRow = {
  user_id: string;
  competition_id: string;
  kind: string;
  athlete_id: string | null;
  discipline: string | null;
  replaced_id: string | null;
  coached_at: string | null;
};

/**
 * The client must carry the player's session (#1091): the database lets a player play their own
 * jokers only, and shows the opponent's once the lineup is locked.
 */
export function createSupabaseManagerJokerRepository(
  client: SupabaseClient,
): ManagerJokerRepository {
  const fail = (): never => {
    throw new UseCaseError("JOKERS_UNAVAILABLE");
  };
  const outcomeOf = (error: { code: string } | null): ManagerJokerOutcome =>
    !error ? "done" : (OUTCOMES[error.code] ?? fail());

  return {
    async leagueJokers(leagueId) {
      const { data, error } = await client
        .from("manager_league_jokers")
        .select("kind")
        .eq("league_id", leagueId)
        .returns<{ kind: string }[]>();
      if (error?.code === "22P02") return [];
      if (error) fail();
      return data!.map((row) => row.kind);
    },

    async plays(leagueId) {
      const { data, error } = await client
        .from("manager_joker_plays")
        .select("user_id, competition_id, kind, athlete_id, discipline, replaced_id, coached_at")
        .eq("league_id", leagueId)
        .returns<PlayRow[]>();
      if (error?.code === "22P02") return [];
      if (error) fail();
      return data!.flatMap((row) =>
        isManagerJoker(row.kind)
          ? [
              {
                userId: row.user_id,
                competitionId: row.competition_id,
                kind: row.kind,
                athleteId: row.athlete_id,
                discipline: row.discipline,
                replacedId: row.replaced_id,
                coached: row.coached_at !== null,
              },
            ]
          : [],
      );
    },

    async duel(leagueId, competitionId) {
      const { data, error } = await client.rpc("manager_joker_duel", {
        p_league: leagueId,
        p_competition: competitionId,
      });
      if (error?.code === "42501" || error?.code === "22P02") return "not_member";
      if (error) fail();
      const row = data as {
        home: boolean;
        opponent_id: string;
        opponent_team: { athlete_id: string; name: string }[];
      } | null;
      return (
        row && {
          home: row.home,
          opponentId: row.opponent_id,
          opponentTeam: row.opponent_team.map((a) => ({ athleteId: a.athlete_id, name: a.name })),
        }
      );
    },

    async play(leagueId, competitionId, kind, athleteId) {
      const { error } = await client.rpc("play_manager_joker", {
        p_league: leagueId,
        p_competition: competitionId,
        p_kind: kind,
        p_athlete: athleteId,
      });
      return outcomeOf(error);
    },

    async remove(leagueId, competitionId) {
      const { error } = await client.rpc("remove_manager_joker", {
        p_league: leagueId,
        p_competition: competitionId,
      });
      return outcomeOf(error);
    },

    async coach(leagueId, competitionId, outId, inId) {
      const { error } = await client.rpc("coach_manager_lineup", {
        p_league: leagueId,
        p_competition: competitionId,
        p_out: outId,
        p_in: inId,
      });
      return outcomeOf(error);
    },
  };
}
