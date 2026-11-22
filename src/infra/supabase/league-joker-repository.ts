import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { JokerOutcome, LeagueJokerRepository } from "@/application/league-jokers";
import { isPredictionJoker } from "@/domain/league-jokers";

/** What `play_league_joker` and `remove_league_joker` raise, as outcomes. */
const OUTCOMES: Record<string, JokerOutcome> = {
  FT043: "locked",
  FT045: "not_available",
  FT046: "spy_spent",
  FT047: "not_in_league",
  "42501": "not_member",
  // An id that is not a uuid: no such league.
  "22P02": "not_member",
};

/**
 * The client must carry the player's session (#1090): the database lets a player play their own
 * jokers only, and shows the others' once the event is locked.
 */
export function createSupabaseLeagueJokerRepository(client: SupabaseClient): LeagueJokerRepository {
  const fail = (): never => {
    throw new UseCaseError("JOKERS_UNAVAILABLE");
  };
  const outcomeOf = (error: { code: string } | null): JokerOutcome =>
    !error ? "done" : (OUTCOMES[error.code] ?? fail());

  return {
    async catalogue(game) {
      const { data, error } = await client
        .from("jokers")
        .select("kind, active")
        .eq("game", game)
        .order("position")
        .returns<{ kind: string; active: boolean }[]>();
      if (error) fail();
      return data!.map((row) => ({ joker: row.kind, active: row.active }));
    },

    async setActive(game, joker, active) {
      const { error } = await client.rpc("set_joker_active", {
        p_game: game,
        p_kind: joker,
        p_active: active,
      });
      if (!error) return "saved";
      if (error.code === "42501") return "not_admin";
      if (error.code === "P0002") return "unknown";
      return fail();
    },

    async leagueJokers(leagueId) {
      const { data, error } = await client
        .from("league_jokers")
        .select("kind")
        .eq("league_id", leagueId)
        .returns<{ kind: string }[]>();
      if (error?.code === "22P02") return [];
      if (error) fail();
      return data!.map((row) => row.kind);
    },

    async plays(leagueId) {
      const { data, error } = await client
        .from("league_joker_plays")
        .select("user_id, event_id, kind")
        .eq("league_id", leagueId)
        .returns<{ user_id: string; event_id: string; kind: string }[]>();
      if (error?.code === "22P02") return [];
      if (error) fail();
      return data!.flatMap((row) =>
        isPredictionJoker(row.kind)
          ? [{ userId: row.user_id, eventId: row.event_id, joker: row.kind }]
          : [],
      );
    },

    async play(leagueId, eventId, joker) {
      const { error } = await client.rpc("play_league_joker", {
        p_league: leagueId,
        p_event: eventId,
        p_kind: joker,
      });
      return outcomeOf(error);
    },

    async remove(leagueId, eventId) {
      const { error } = await client.rpc("remove_league_joker", {
        p_league: leagueId,
        p_event: eventId,
      });
      return outcomeOf(error);
    },
  };
}
