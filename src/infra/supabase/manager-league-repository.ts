import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ManagerLeagueRepository } from "@/application/manager-leagues";
import type { ManagerRules } from "@/domain/manager-rules";

type LeagueRow = {
  id: string;
  name: string;
  is_public: boolean;
  invite_code: string;
  owner_id: string;
};

const league = (row: LeagueRow, memberCount: number) => ({
  id: row.id,
  name: row.name,
  isPublic: row.is_public,
  inviteCode: row.invite_code,
  ownerId: row.owner_id,
  memberCount,
});

/** The player's session: row level security shows them the leagues they are in only. */
export function createSupabaseManagerLeagueRepository(client: SupabaseClient): ManagerLeagueRepository {
  return {
    async create(name, isPublic) {
      const { data, error } = await client.rpc("create_manager_league", {
        p_name: name,
        p_public: isPublic,
      });
      if (error?.code === "FT010") return "banned";
      if (error?.code === "23514") throw new UseCaseError("LEAGUE_NAME_INVALID");
      if (error || typeof data !== "string") throw new UseCaseError("LEAGUES_UNAVAILABLE");
      return { id: data };
    },

    async listMine() {
      const { data, error } = await client
        .from("manager_leagues")
        .select("id, name, is_public, invite_code, owner_id, manager_members(count)")
        .returns<(LeagueRow & { manager_members: { count: number }[] })[]>();
      if (error) throw new UseCaseError("LEAGUES_UNAVAILABLE");
      return data.map((row) => league(row, row.manager_members[0]?.count ?? 0));
    },

    async find(id) {
      const { data, error } = await client
        .from("manager_leagues")
        .select(
          "id, name, is_public, invite_code, owner_id, rules, competition_ids, manager_members(user_id, joined_at, profiles!inner(pseudo, avatar_emoji))",
        )
        .eq("id", id)
        .returns<
          (LeagueRow & {
            rules: ManagerRules;
            competition_ids: string[];
            manager_members: {
              user_id: string;
              joined_at: string;
              profiles: { pseudo: string; avatar_emoji: string };
            }[];
          })[]
        >();
      // A malformed id is a league that does not exist (22P02), not a broken database.
      if (error?.code === "22P02") return null;
      if (error) throw new UseCaseError("LEAGUES_UNAVAILABLE");
      const row = data[0];
      if (!row) return null;
      const members = [...row.manager_members].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
      return {
        ...league(row, members.length),
        rules: row.rules,
        competitionCount: row.competition_ids.length,
        participants: members.map((m) => ({
          userId: m.user_id,
          pseudo: m.profiles.pseudo,
          avatar: m.profiles.avatar_emoji,
        })),
      };
    },
  };
}
