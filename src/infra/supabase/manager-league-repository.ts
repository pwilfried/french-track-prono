import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { JoinOutcome, ManagerLeagueRepository } from "@/application/manager-leagues";
import { bibOf } from "@/domain/bib";
import type { LeagueCompetition } from "@/domain/manager-league";
import type { ManagerRules } from "@/domain/manager-rules";

type LeagueRow = {
  id: string;
  name: string;
  is_public: boolean;
  invite_code: string;
  owner_id: string;
  player_target: number;
};

type MercatoRow = {
  mercato_starts_at: string | null;
  mercato_opened_at: string | null;
  round_mode: "auto" | "custom";
};

const iso = (time: string | null) => (time === null ? null : new Date(time).toISOString());

type CompetitionRow = { competition_id: string; name: string; starts_at: string };

/** The competitions as the database answers them, first first. */
function competitions(result: { data: unknown; error: unknown }): LeagueCompetition[] {
  if (result.error) throw new UseCaseError("LEAGUES_UNAVAILABLE");
  return (result.data as CompetitionRow[]).map((row) => ({
    id: row.competition_id,
    name: row.name,
    startsAt: new Date(row.starts_at).toISOString(),
  }));
}

const league = (row: LeagueRow, memberCount: number) => ({
  id: row.id,
  name: row.name,
  isPublic: row.is_public,
  inviteCode: row.invite_code,
  ownerId: row.owner_id,
  memberCount,
  target: row.player_target,
});

/** What a join function answered: the league, or why the player stays out. */
function outcome(result: { data: unknown; error: { code: string } | null }): JoinOutcome {
  const { data, error } = result;
  if (!error) return typeof data === "string" ? { outcome: "joined", leagueId: data } : { outcome: "unknown" };
  if (error.code === "P0002" || error.code === "22P02") return { outcome: "unknown" };
  if (error.code === "54000") return { outcome: "full" };
  if (error.code === "FT012") return { outcome: "too_many" };
  if (error.code === "FT015") return { outcome: "mercato_open" };
  throw new UseCaseError("LEAGUES_UNAVAILABLE");
}

/** The player's session: row level security shows them the leagues they are in only. */
export function createSupabaseManagerLeagueRepository(client: SupabaseClient): ManagerLeagueRepository {
  return {
    async create(name, isPublic, competitionIds) {
      const { data, error } = await client.rpc("create_manager_league", {
        p_name: name,
        p_public: isPublic,
        p_competitions: competitionIds,
      });
      if (error?.code === "FT010") return "banned";
      if (error?.code === "FT027" || error?.code === "22P02") return "competitions_refused";
      if (error?.code === "23514") throw new UseCaseError("LEAGUE_NAME_INVALID");
      if (error || typeof data !== "string") throw new UseCaseError("LEAGUES_UNAVAILABLE");
      return { id: data };
    },

    async openCompetitions() {
      return competitions(await client.rpc("list_open_manager_competitions"));
    },

    async join(code) {
      return outcome(await client.rpc("join_manager_league", { p_code: code }));
    },

    async joinPublic(id) {
      return outcome(await client.rpc("join_public_manager_league", { p_league: id }));
    },

    async listPublic() {
      const { data, error } = await client.rpc("list_public_manager_leagues");
      if (error) throw new UseCaseError("LEAGUES_UNAVAILABLE");
      return (
        data as { league_id: string; name: string; member_count: number; player_target: number }[]
      ).map((row) => ({
        id: row.league_id,
        name: row.name,
        memberCount: Number(row.member_count),
        target: row.player_target,
      }));
    },

    async listMine() {
      const { data, error } = await client
        .from("manager_leagues")
        .select("id, name, is_public, invite_code, owner_id, player_target, manager_members(count)")
        .returns<(LeagueRow & { manager_members: { count: number }[] })[]>();
      if (error) throw new UseCaseError("LEAGUES_UNAVAILABLE");
      return data.map((row) => league(row, row.manager_members[0]?.count ?? 0));
    },

    async find(id) {
      const { data, error } = await client
        .from("manager_leagues")
        .select(
          "id, name, is_public, invite_code, owner_id, rules, player_target, mercato_starts_at, mercato_opened_at, round_mode, manager_members(user_id, joined_at, profiles!inner(pseudo, bib_number, bib_color))",
        )
        .eq("id", id)
        .returns<
          (LeagueRow &
            MercatoRow & {
            rules: ManagerRules;
            manager_members: {
              user_id: string;
              joined_at: string;
              profiles: { pseudo: string; bib_number: number; bib_color: string };
            }[];
          })[]
        >();
      // A malformed id is a league that does not exist (22P02), not a broken database.
      if (error?.code === "22P02") return null;
      if (error) throw new UseCaseError("LEAGUES_UNAVAILABLE");
      const row = data[0];
      if (!row) return null;
      const played = competitions(
        await client.rpc("manager_league_competitions", { p_league: id }),
      );
      const members = [...row.manager_members].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
      return {
        ...league(row, members.length),
        rules: row.rules,
        competitions: played,
        mercato: {
          target: row.player_target,
          startsAt: iso(row.mercato_starts_at),
          openedAt: iso(row.mercato_opened_at),
          roundMode: row.round_mode,
        },
        participants: members.map((m) => ({
          userId: m.user_id,
          pseudo: m.profiles.pseudo,
          bib: bibOf(m.profiles.bib_number, m.profiles.bib_color),
        })),
      };
    },

    async setMercato(id, settings) {
      const { rounds } = settings;
      const { error } = await client.rpc("set_manager_mercato", {
        p_league: id,
        p_starts_at: settings.startsAt,
        p_mode: rounds.mode,
        p_first_hours: rounds.mode === "custom" ? rounds.firstHours : null,
        p_next_hours: rounds.mode === "custom" ? rounds.nextHours : null,
      });
      if (!error) return "set";
      if (error.code === "42501") return "not_owner";
      if (error.code === "FT015") return "mercato_open";
      if (error.code === "22023") throw new UseCaseError("MERCATO_ROUNDS_INVALID");
      throw new UseCaseError("LEAGUES_UNAVAILABLE");
    },

    async launchMercato(id) {
      const { error } = await client.rpc("launch_manager_mercato", { p_league: id });
      if (!error) return "launched";
      if (error.code === "42501") return "not_owner";
      if (error.code === "FT015") return "mercato_open";
      if (error.code === "FT026") return "players_missing";
      if (error.code === "FT028") return "competitions_short";
      throw new UseCaseError("LEAGUES_UNAVAILABLE");
    },
  };
}
