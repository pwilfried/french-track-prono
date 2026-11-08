import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { League, LeagueMember, LeagueRepository } from "@/application/leagues";

type LeagueRow = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  league_members: { count: number }[];
  league_competitions: { competitions: { slug: string } | null }[];
};

const fail = (): never => {
  throw new UseCaseError("LEAGUES_UNAVAILABLE");
};

/** The client must carry the player's session: the database functions act as that player. */
export function createSupabaseLeagueRepository(client: SupabaseClient): LeagueRepository {
  const listMine = async (): Promise<League[]> => {
    // Row level security only shows the leagues the player is a member of.
    const { data, error } = await client
      .from("leagues")
      .select("id, name, invite_code, owner_id, league_members(count), league_competitions(competitions(slug))")
      .returns<LeagueRow[]>();
    if (error) fail();
    return data!.map((row) => ({
      id: row.id,
      name: row.name,
      inviteCode: row.invite_code,
      ownerId: row.owner_id,
      memberCount: row.league_members[0]?.count ?? 0,
      competitionSlugs: row.league_competitions
        .flatMap((lc) => (lc.competitions ? [lc.competitions.slug] : []))
        .sort(),
    }));
  };

  return {
    listMine,

    async create(name, competitionSlugs) {
      const { data, error } = await client.rpc("create_league", {
        p_name: name,
        p_competition_slugs: competitionSlugs,
      });
      const row = (data as { league_id: string; invite_code: string }[] | null)?.[0];
      if (error || !row) return fail();
      const { data: user } = await client.auth.getUser();
      if (!user.user) return fail();
      return {
        id: row.league_id,
        name,
        inviteCode: row.invite_code,
        ownerId: user.user.id,
        memberCount: 1,
        competitionSlugs: [...new Set(competitionSlugs)].sort(),
      };
    },

    async join(code) {
      const before = new Set((await listMine()).map((l) => l.id));
      const { data, error } = await client.rpc("join_league", { p_code: code });
      if (error) {
        if (error.code === "P0002") return { outcome: "unknown_code" };
        if (error.code === "54000") return { outcome: "full" };
        return fail();
      }
      const leagueId = data as string;
      return { outcome: before.has(leagueId) ? "already_member" : "joined", leagueId };
    },

    async members(leagueId) {
      const { data, error } = await client
        .from("league_members")
        .select("user_id, profiles!inner(pseudo, avatar_emoji)")
        .eq("league_id", leagueId)
        .returns<{ user_id: string; profiles: { pseudo: string; avatar_emoji: string } }[]>();
      if (error) fail();
      // A non member reads no row (row level security); a league has at least its owner.
      if (data!.length === 0) return null;
      return data!.map(
        (row): LeagueMember => ({ userId: row.user_id, pseudo: row.profiles.pseudo, avatar: row.profiles.avatar_emoji }),
      );
    },

    async leave(leagueId) {
      const { error } = await client.rpc("leave_league", { p_league: leagueId });
      if (!error) return "left";
      if (error.code === "2BP01") return "must_hand_over";
      return fail();
    },

    async handOver(leagueId, newOwnerId) {
      const { error } = await client.rpc("transfer_league", { p_league: leagueId, p_new_owner: newOwnerId });
      if (!error) return "done";
      if (error.code === "42501") return "not_owner";
      if (error.code === "P0002") return "unknown_member";
      return fail();
    },

    async addCompetition(leagueId, competitionSlug) {
      const { error } = await client.rpc("add_league_competition", {
        p_league: leagueId,
        p_competition_slug: competitionSlug,
      });
      if (!error) return "added";
      if (error.code === "42501") return "not_owner";
      if (error.code === "P0002") return "unknown";
      if (error.code === "FT009") return "started";
      return fail();
    },
  };
}
