import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { League, LeagueMember, LeagueRepository } from "@/application/leagues";
import { bibOf } from "@/domain/bib";
import {
  LEAGUE_FAMILIES,
  inScreenOrder,
  type LeagueFamily,
  type LeagueFamilyRule,
} from "@/domain/league-families";

type LeagueRow = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  is_public: boolean;
  is_official: boolean;
  league_members: { count: number }[];
  league_competitions: { added_at: string | null; competitions: { slug: string } | null }[];
  league_families: { family: LeagueFamily; added_at: string | null }[];
};

/** The families of a league in the order of the screen; absent for a league on all events. */
const familiesOf = (rows: { family: LeagueFamily; added_at: string | null }[]) =>
  rows.length > 0
    ? {
        families: inScreenOrder(
          rows.map(
            (r): LeagueFamilyRule => ({
              family: r.family,
              addedAt: r.added_at === null ? null : new Date(r.added_at).toISOString(),
            }),
          ),
        ),
      }
    : {};

/**
 * When each competition entered the league (#614); absent when every competition counts from the
 * start (added before #614, or the official league).
 */
const addedAtOf = (rows: LeagueRow["league_competitions"]) => {
  const dated = rows.flatMap((lc) =>
    lc.competitions && lc.added_at
      ? [[lc.competitions.slug, new Date(lc.added_at).toISOString()] as const]
      : [],
  );
  return dated.length > 0 ? { competitionAddedAt: Object.fromEntries(dated) } : {};
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
      .select("id, name, invite_code, owner_id, is_public, is_official, league_members(count), league_competitions(added_at, competitions(slug)), league_families(family, added_at)")
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
      ...addedAtOf(row.league_competitions),
      isPublic: row.is_public,
      // Only when it is: the other leagues stay as the contract describes them.
      ...(row.is_official ? { isOfficial: true } : {}),
      ...familiesOf(row.league_families),
    }));
  };

  return {
    listMine,

    async create(name, competitionSlugs, isPublic, families = []) {
      const { data, error } = await client.rpc("create_league", {
        p_name: name,
        p_competition_slugs: competitionSlugs,
        p_public: isPublic,
        p_families: families,
      });
      if (error?.code === "FT010") throw new UseCaseError("LEAGUE_NAME_BANNED");
      if (error?.code === "FT014") throw new UseCaseError("ACCOUNT_BLOCKED");
      if (error?.code === "FT009") throw new UseCaseError("COMPETITION_FINISHED");
      if (error?.code === "FT030") throw new UseCaseError("LEAGUE_COMPETITION_REQUIRED");
      const row = (data as { league_id: string; invite_code: string }[] | null)?.[0];
      if (error || !row) return fail();
      // Read back, with the dates the competitions entered it at (#614).
      return (await listMine()).find((l) => l.id === row.league_id) ?? fail();
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
      if (error.code === "FT009") return "finished";
      return fail();
    },

    async addFamily(leagueId, family) {
      const { error } = await client.rpc("add_league_family", {
        p_league: leagueId,
        p_family: family,
      });
      if (!error) return "added";
      if (error.code === "42501") return "not_owner";
      if (error.code === "FT029") return "all_events";
      return fail();
    },

    async listPublic() {
      const { data, error } = await client.rpc("list_public_leagues");
      if (error) return fail();
      return (
        data as {
          league_id: string;
          name: string;
          member_count: number;
          competition_slugs: string[];
          is_official: boolean;
          families: LeagueFamily[];
          created_at: string;
        }[]
      ).map((row) => {
        const families = LEAGUE_FAMILIES.filter((f) => row.families.includes(f));
        return {
          id: row.league_id,
          name: row.name,
          memberCount: Number(row.member_count),
          competitionSlugs: row.competition_slugs,
          ...(row.is_official ? { isOfficial: true } : {}),
          ...(families.length > 0 ? { families } : {}),
          createdAt: new Date(row.created_at).toISOString(),
        };
      });
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
