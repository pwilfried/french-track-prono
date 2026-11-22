import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { SeasonFacts, TrophyRepository } from "@/application/trophies";
import { isPredictionJoker } from "@/domain/league-jokers";
import type { LeagueFamilyRule } from "@/domain/league-families";
import type { Animal } from "@/domain/band";
import type { Metal, Trophy, TrophyKind } from "@/domain/trophies";

type FactsJson = {
  witness_id: string | null;
  competitions: { slug: string; ends_on: string }[];
  leagues: {
    id: string;
    name: string;
    members: { user_id: string; joined_at: string; counted?: string[] }[];
    competitions: { slug: string; ends_on: string; added_at: string | null }[];
    families: { family: LeagueFamilyRule["family"]; added_at: string | null }[];
    jokers?: { user_id: string; event_id: string; kind: string }[];
  }[];
  manager: {
    league_id: string;
    league_name: string;
    ended_at: string;
    standings: { user_id: string; rank: number }[];
  }[];
};

type TrophyRow = {
  user_id: string;
  season: number;
  kind: TrophyKind;
  metal: Metal | null;
  league_id: string | null;
  league_name: string | null;
  animal: Animal | null;
};

const iso = (value: string | null) => (value ? new Date(value).toISOString() : null);

const toFacts = (json: FactsJson): SeasonFacts => ({
  witnessId: json.witness_id,
  competitions: json.competitions.map((c) => ({ slug: c.slug, endsOn: c.ends_on })),
  leagues: json.leagues.map((l) => ({
    id: l.id,
    name: l.name,
    members: l.members.map((m) => ({
      userId: m.user_id,
      joinedAt: iso(m.joined_at)!,
      countedEvents: m.counted ?? [],
    })),
    competitions: l.competitions.map((c) => ({
      slug: c.slug,
      endsOn: c.ends_on,
      addedAt: iso(c.added_at),
    })),
    families: l.families.map((f) => ({ family: f.family, addedAt: iso(f.added_at) })),
    jokerPlays: (l.jokers ?? []).flatMap((j) =>
      isPredictionJoker(j.kind) ? [{ userId: j.user_id, eventId: j.event_id, joker: j.kind }] : [],
    ),
  })),
  manager: json.manager.map((h) => ({
    leagueId: h.league_id,
    leagueName: h.league_name,
    endedAt: iso(h.ended_at)!,
    standings: (h.standings ?? []).map((s) => ({ userId: s.user_id, rank: s.rank })),
  })),
});

const toTrophy = (row: TrophyRow): Trophy => ({
  userId: row.user_id,
  season: row.season,
  kind: row.kind,
  metal: row.metal,
  leagueId: row.league_id,
  leagueName: row.league_name,
  animal: row.animal,
});

/** Code 42501: the database refused a player who is not an admin. */
const refuse = (error: { code?: string }): never => {
  throw new UseCaseError(error.code === "42501" ? "NOT_ADMIN" : "TROPHIES_UNAVAILABLE");
};

/** The season trophies (#822): drawn by the admin, read under row level security. */
export function createSupabaseTrophyRepository(client: SupabaseClient): TrophyRepository {
  return {
    async seasonFacts(season) {
      const { data, error } = await client.rpc("admin_trophy_facts", { p_season: season });
      if (error) return refuse(error);
      return toFacts(data as FactsJson);
    },
    async replaceSeason(season, trophies) {
      const { error } = await client.rpc("admin_replace_trophies", {
        p_season: season,
        p_trophies: trophies.map((t) => ({
          user_id: t.userId,
          kind: t.kind,
          metal: t.metal,
          league_id: t.leagueId,
          league_name: t.leagueName,
          animal: t.animal,
        })),
      });
      if (error) refuse(error);
    },
    async ofPlayer(userId) {
      // A few trophies a season: one page is enough.
      const { data, error } = await client
        .from("trophies")
        .select("user_id, season, kind, metal, league_id, league_name, animal")
        .eq("user_id", userId)
        .order("season", { ascending: false });
      if (error) throw new UseCaseError("TROPHIES_UNAVAILABLE");
      return ((data ?? []) as TrophyRow[]).map(toTrophy);
    },
    async witness() {
      const { data, error } = await client.rpc("admin_trophy_witness");
      if (error) return refuse(error);
      return (data as string | null) ?? null;
    },
    async setWitness(pseudo) {
      const { data, error } = await client.rpc("admin_set_trophy_witness", { p_pseudo: pseudo });
      if (error) return refuse(error);
      return data as "saved" | "cleared" | "unknown";
    },
  };
}
