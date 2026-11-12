import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { League, LeagueMember, LeagueRepository } from "@/application/leagues";
import { bibOf } from "@/domain/bib";

type LeagueRow = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  is_public: boolean;
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
      .select("id, name, invite_code, owner_id, is_public, league_members(count), league_competitions(competitions(slug))")
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
      isPublic: row.is_public,
    }));
  };

  return {
    listMine,

    async create(name, competitionSlugs, isPublic) {
      const { data, error } = await client.rpc("create_league", {
        p_name: name,
        p_competition_slugs: competitionSlugs,
        p_public: isPublic,
      });
      if (error?.code === "FT010") throw new UseCaseError("LEAGUE_NAME_BANNED");
      if (error?.code === "FT014") throw new UseCaseError("ACCOUNT_BLOCKED");
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
        isPublic,
      };
    },

    async join(code) {
      const before = new Set((await listMine()).map((l) => l.id));
      const { data, error } = await client.rpc("join_league", { p_code: code });
      if (error) {
        if (error.code === "54000") return { outcome: "full" };
        if (error.code === "FT012") return { outcome: "too_many" };
        if (error.code === "FT014") throw new UseCaseError("ACCOUNT_BLOCKED");
        return fail();
      }
      // An unknown code answers nothing (the database remembers the failed attempt).
      if (!data) return { outcome: "unknown_code" };
      const leagueId = data as string;
      return { outcome: before.has(leagueId) ? "already_member" : "joined", leagueId };
    },

    async members(leagueId) {
      const { data, error } = await client
        .from("league_members")
        .select(
          "user_id, joined_at, profiles!inner(pseudo, bib_number, bib_color, club:clubs(name))",
        )
        .eq("league_id", leagueId)
        .returns<
          {
            user_id: string;
            joined_at: string;
            profiles: {
              pseudo: string;
              bib_number: number;
              bib_color: string;
              club: { name: string } | null;
            };
          }[]
        >();
      if (error) fail();
      // A non member reads no row (row level security); a league has at least its owner.
      if (data!.length === 0) return null;
      return data!.map(
        (row): LeagueMember => ({
          userId: row.user_id,
          pseudo: row.profiles.pseudo,
          bib: bibOf(row.profiles.bib_number, row.profiles.bib_color),
          club: row.profiles.club?.name ?? null,
          joinedAt: new Date(row.joined_at).toISOString(),
        }),
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

    async listPublic() {
      const { data, error } = await client.rpc("list_public_leagues");
      if (error) return fail();
      return (
        data as { league_id: string; name: string; member_count: number; competition_slugs: string[] }[]
      ).map((row) => ({
        id: row.league_id,
        name: row.name,
        memberCount: Number(row.member_count),
        competitionSlugs: row.competition_slugs,
      }));
    },

    async joinPublic(leagueId) {
      const before = new Set((await listMine()).map((l) => l.id));
      const { error } = await client.rpc("join_public_league", { p_league: leagueId });
      if (error) {
        if (error.code === "P0002" || error.code === "22P02") return { outcome: "unknown_code" };
        if (error.code === "54000") return { outcome: "full" };
        if (error.code === "FT014") throw new UseCaseError("ACCOUNT_BLOCKED");
        return fail();
      }
      return { outcome: before.has(leagueId) ? "already_member" : "joined", leagueId };
    },

    async report(leagueId) {
      const { error } = await client.rpc("report_league", { p_league: leagueId });
      if (!error) return "reported";
      if (error.code === "P0002" || error.code === "22P02") return "unknown";
      return fail();
    },
  };
}
