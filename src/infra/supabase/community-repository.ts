import type { SupabaseClient } from "@supabase/supabase-js";

import type { CommunityRepository, VoteOutcome } from "@/application/community";
import { UseCaseError } from "@/application/errors";
import { isAnnouncementKind, type Announcement } from "@/domain/community";

type AnnouncementRow = {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  link: string | null;
  published_at: string;
};

type PollRow = {
  id: string;
  question: string;
  options: string[];
  closes_at: string;
  my_choice: number | null;
  votes: number[] | null;
};

const iso = (value: string) => new Date(value).toISOString();

const VOTE_ERRORS: Record<string, VoteOutcome> = {
  "23505": "already_voted",
  FT034: "closed",
  P0002: "not_found",
  "22023": "invalid",
};

/**
 * Announcements and polls: the admin's session publishes (admin_ functions check it); a player's
 * session reads them and votes through vote_poll().
 */
export function createSupabaseCommunityRepository(client: SupabaseClient): CommunityRepository {
  const admin = async (rpc: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(rpc, args);
    if (error) {
      if (error.code === "42501") return "not_admin" as const;
      if (error.code === "22023") {
        throw new UseCaseError(rpc.includes("poll") ? "POLL_INVALID" : "ANNOUNCEMENT_INVALID");
      }
      throw new UseCaseError("COMMUNITY_UNAVAILABLE");
    }
    return { data };
  };

  return {
    async announcements() {
      const { data, error } = await client
        .from("announcements")
        .select("id, kind, title, subtitle, link, published_at")
        .order("published_at", { ascending: false })
        .order("id")
        .limit(20);
      if (error) throw new UseCaseError("COMMUNITY_UNAVAILABLE");
      return ((data ?? []) as AnnouncementRow[]).flatMap((row): Announcement[] =>
        isAnnouncementKind(row.kind)
          ? [
              {
                id: row.id,
                kind: row.kind,
                title: row.title,
                subtitle: row.subtitle,
                link: row.link,
                publishedAt: iso(row.published_at),
              },
            ]
          : [],
      );
    },

    async polls() {
      const { data, error } = await client.rpc("community_polls");
      if (error) throw new UseCaseError("COMMUNITY_UNAVAILABLE");
      return ((data ?? []) as PollRow[]).map((row) => ({
        id: row.id,
        question: row.question,
        options: row.options,
        closesAt: iso(row.closes_at),
        myChoice: row.my_choice,
        votes: row.votes,
      }));
    },

    async vote(pollId, choice) {
      const { error } = await client.rpc("vote_poll", { p_poll: pollId, p_choice: choice });
      if (!error) return "voted";
      const outcome = VOTE_ERRORS[error.code];
      if (outcome) return outcome;
      throw new UseCaseError("COMMUNITY_UNAVAILABLE");
    },

    async publishAnnouncement(announcement) {
      const result = await admin("admin_publish_announcement", {
        p_kind: announcement.kind,
        p_title: announcement.title,
        p_subtitle: announcement.subtitle,
        p_link: announcement.link,
      });
      return result === "not_admin" ? result : (result.data as string);
    },

    async removeAnnouncement(id) {
      const result = await admin("admin_remove_announcement", { p_id: id });
      return result === "not_admin" ? result : "removed";
    },

    async createPoll(poll) {
      const result = await admin("admin_create_poll", {
        p_question: poll.question,
        p_options: poll.options,
        p_closes_at: poll.closesAt,
      });
      return result === "not_admin" ? result : (result.data as string);
    },

    async removePoll(id) {
      const result = await admin("admin_remove_poll", { p_id: id });
      return result === "not_admin" ? result : "removed";
    },
  };
}
