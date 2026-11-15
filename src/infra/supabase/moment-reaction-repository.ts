import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { MomentReactionRepository, MomentReport } from "@/application/moment-reactions";
import { bibOf } from "@/domain/bib";
import { isMomentKind } from "@/domain/league-moments";
import type { MomentResponse } from "@/domain/moment-reactions";

type ReactionRow = {
  id: string;
  moment_key: string;
  kind: "emoji" | "message";
  code: string;
  pseudo: string;
  bib_number: number;
  bib_color: string;
  mine: boolean;
  reported: boolean;
};

type ReportRow = {
  reaction_id: string;
  kind: "emoji" | "message";
  code: string;
  pseudo: string;
  league_id: string;
  league_name: string;
  moment_kind: string;
  report_count: number;
  last_reported_at: string;
};

// Not a member (42501), an unknown moment (P0002), a code out of the lists (23514).
const REFUSED = new Set(["42501", "P0002", "23514"]);

const fail = (): never => {
  throw new UseCaseError("LEAGUES_UNAVAILABLE");
};


/**
 * The client carries the player's session: the database functions check the member, the lists
 * and the admin; row level security hides what is hidden, and everything outside the league.
 */
export function createSupabaseMomentReactionRepository(
  client: SupabaseClient,
): MomentReactionRepository {
  const write = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await client.rpc(fn, args);
    if (!error) return "done" as const;
    if (REFUSED.has(error.code)) return "refused" as const;
    return fail();
  };
  const moderate = async (fn: string, reactionId: string) => {
    const { error } = await client.rpc(fn, { p_reaction: reactionId });
    if (!error) return "done" as const;
    if (error.code === "42501") return "not_admin" as const;
    // An unknown id, or one that is not a UUID.
    if (error.code === "P0002" || error.code === "22P02") return "unknown" as const;
    return fail();
  };

  return {
    async list(leagueId) {
      const { data, error } = await client.rpc("league_feed_reactions", { p_league: leagueId });
      if (error) fail();
      return ((data ?? []) as ReactionRow[]).map(
        (row): MomentResponse => ({
          id: row.id,
          momentKey: row.moment_key,
          kind: row.kind,
          code: row.code,
          pseudo: row.pseudo,
          bib: bibOf(row.bib_number, row.bib_color),
          mine: row.mine,
          reported: row.reported,
        }),
      );
    },

    addEmoji: (leagueId, momentKey, emoji) =>
      write("add_moment_reaction", { p_league: leagueId, p_key: momentKey, p_code: emoji }),

    removeEmoji: (leagueId, momentKey, emoji) =>
      write("remove_moment_reaction", { p_league: leagueId, p_key: momentKey, p_code: emoji }),

    sendMessage: (leagueId, momentKey, message) =>
      write("send_moment_message", { p_league: leagueId, p_key: momentKey, p_code: message }),

    async report(reactionId) {
      const { error } = await client.rpc("report_moment_reaction", { p_reaction: reactionId });
      if (!error) return "done";
      if (error.code === "P0002" || error.code === "22P02") return "unknown";
      if (error.code === "FT035") return "too_many";
      return fail();
    },

    async reports() {
      const { data, error } = await client.rpc("admin_list_moment_reports");
      if (error) {
        if (error.code === "42501") return "not_admin";
        return fail();
      }
      return ((data ?? []) as ReportRow[]).flatMap((row): MomentReport[] =>
        isMomentKind(row.moment_kind)
          ? [
              {
                id: row.reaction_id,
                kind: row.kind,
                code: row.code,
                pseudo: row.pseudo,
                leagueId: row.league_id,
                leagueName: row.league_name,
                momentKind: row.moment_kind,
                reports: Number(row.report_count),
                lastReportedAt: new Date(row.last_reported_at).toISOString(),
              },
            ]
          : [],
      );
    },

    hide: (reactionId) => moderate("admin_hide_moment_reaction", reactionId),
    dismiss: (reactionId) => moderate("admin_dismiss_moment_reports", reactionId),
  };
}
