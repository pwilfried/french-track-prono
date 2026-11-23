import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { LeagueMomentRepository, MomentLeague } from "@/application/league-moments";
import { BADGE_LEVELS, BADGES, type Badge, type BadgeLevel } from "@/domain/badges";
import { ANIMALS, type Animal } from "@/domain/band";
import { bibOf } from "@/domain/bib";
import { inScreenOrder, type LeagueFamily } from "@/domain/league-families";
import { isPredictionJoker } from "@/domain/league-jokers";
import { isMomentKind, type FeedMoment, type FeedTrophy } from "@/domain/league-moments";

type LeagueRow = {
  id: string;
  competitions: { slug: string; added_at: string | null }[] | null;
  families: { family: LeagueFamily; added_at: string | null }[];
  members: { user_id: string; joined_at: string | null; counted?: string[] }[] | null;
  jokers?: { user_id: string; event_id: string; kind: string }[];
};

/** A moment as the database gives it; the Manager feed (#875) gives no event, nor other player. */
export type FeedRow = {
  key: string;
  kind: string;
  happened_at: string;
  pseudo: string;
  bib_number: number;
  bib_color: string;
  other_pseudo?: string | null;
  competition_name?: string | null;
  discipline?: string | null;
  gender?: string | null;
  data: {
    length?: number;
    price?: number;
    badge?: string;
    level?: string;
    scores?: [number, number];
    /** A trophy moment (#1134); the feed gives the pseudos of the podium. */
    trophy?: string;
    animal?: string;
    points?: number;
    podium?: { pseudo: string; metal: string }[];
  };
};

const iso = (value: string) => new Date(value).toISOString();
const isGender = (gender: string | null | undefined): gender is "F" | "M" | "X" =>
  gender === "F" || gender === "M" || gender === "X";

function leagueOf(row: LeagueRow): MomentLeague {
  const competitions = row.competitions ?? [];
  const dated = competitions.flatMap((c) => (c.added_at ? [[c.slug, iso(c.added_at)] as const] : []));
  return {
    id: row.id,
    competitionSlugs: competitions.map((c) => c.slug).sort(),
    ...(dated.length > 0 ? { competitionAddedAt: Object.fromEntries(dated) } : {}),
    ...(row.families.length > 0
      ? {
          families: inScreenOrder(
            row.families.map((f) => ({
              family: f.family,
              addedAt: f.added_at === null ? null : iso(f.added_at),
            })),
          ),
        }
      : {}),
    members: (row.members ?? []).map((m) => ({
      userId: m.user_id,
      ...(m.joined_at ? { joinedAt: iso(m.joined_at) } : {}),
      countedEvents: m.counted ?? [],
    })),
    jokerPlays: (row.jokers ?? []).flatMap((j) =>
      isPredictionJoker(j.kind) ? [{ userId: j.user_id, eventId: j.event_id, joker: j.kind }] : [],
    ),
  };
}

const isBadge = (badge: unknown): badge is Badge => BADGES.includes(badge as Badge);
const isLevel = (level: unknown): level is BadgeLevel => BADGE_LEVELS.includes(level as BadgeLevel);

const TROPHIES: FeedTrophy["kind"][] = ["league", "manager", "chrono", "record"];
const METALS = ["gold", "silver", "bronze"] as const;
type PodiumMetal = (typeof METALS)[number];

/** The trophy of a moment, when the app knows it (#1134). */
function trophyOf(data: FeedRow["data"]): FeedTrophy | null {
  const kind = TROPHIES.find((k) => k === data.trophy);
  if (!kind) return null;
  const podium = (data.podium ?? []).flatMap((p) =>
    METALS.includes(p.metal as PodiumMetal)
      ? [{ pseudo: p.pseudo, metal: p.metal as PodiumMetal }]
      : [],
  );
  return {
    kind,
    ...(ANIMALS.includes(data.animal as Animal) ? { animal: data.animal as Animal } : {}),
    ...(typeof data.points === "number" ? { points: data.points } : {}),
    ...(podium.length > 0 ? { podium } : {}),
  };
}

/** A moment of a feed; a kind, a badge, a level or a trophy the app no longer knows is left out. */
export function momentOf(row: FeedRow): FeedMoment | null {
  if (!isMomentKind(row.kind)) return null;
  const { length, price, badge, level, scores } = row.data ?? {};
  const trophy = row.kind === "trophy" ? trophyOf(row.data ?? {}) : null;
  if (row.kind === "trophy" && !trophy) return null;
  return {
    key: row.key,
    kind: row.kind,
    happenedAt: iso(row.happened_at),
    pseudo: row.pseudo,
    bib: bibOf(row.bib_number, row.bib_color),
    ...(row.other_pseudo ? { otherPseudo: row.other_pseudo } : {}),
    ...(row.competition_name ? { competitionName: row.competition_name } : {}),
    ...(row.discipline && isGender(row.gender)
      ? { event: { discipline: row.discipline, gender: row.gender } }
      : {}),
    ...(typeof length === "number" ? { length } : {}),
    ...(typeof price === "number" ? { price } : {}),
    ...(isBadge(badge) ? { badge } : {}),
    ...(isLevel(level) ? { level } : {}),
    ...(scores ? { scores } : {}),
    ...(trophy ? { trophy } : {}),
  };
}

/**
 * The admin's session publishes (admin_ functions check it); a member's session reads the feed,
 * row level security shows someone outside the league nothing.
 */
export function createSupabaseLeagueMomentRepository(client: SupabaseClient): LeagueMomentRepository {
  return {
    async leaguesOf(competitionSlug) {
      const { data, error } = await client.rpc("admin_moment_leagues", {
        p_competition: competitionSlug,
      });
      if (error) {
        if (error.code === "42501") return "not_admin";
        throw new UseCaseError("LEAGUES_UNAVAILABLE");
      }
      return (data as LeagueRow[]).map(leagueOf);
    },

    async publish(leagueId, moments) {
      const { data, error } = await client.rpc("admin_publish_league_moments", {
        p_league: leagueId,
        p_moments: moments.map((m) => ({
          key: m.key,
          kind: m.kind,
          user_id: m.userId,
          event_id: m.eventId,
          data: m.length !== undefined ? { length: m.length } : {},
        })),
      });
      if (error) {
        if (error.code === "42501") return "not_admin";
        throw new UseCaseError("LEAGUES_UNAVAILABLE");
      }
      return data as number;
    },

    async feed(leagueId) {
      const { data, error } = await client.rpc("league_feed", { p_league: leagueId });
      if (error) throw new UseCaseError("LEAGUES_UNAVAILABLE");
      return ((data ?? []) as FeedRow[]).flatMap((row) => momentOf(row) ?? []);
    },
  };
}
