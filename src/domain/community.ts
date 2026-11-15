import type { FeedMoment } from "./league-moments";

/**
 * The « Dans ma communauté » block of the home (#673): the moments of my leagues, the FrenchTrack
 * announcements and the polls published by the admin. Players write no text (non-goal 6).
 */

/** What an announcement is about; its label lives in the messages file. */
export const ANNOUNCEMENT_KINDS = ["episode", "competition_open", "schedule"] as const;
export type AnnouncementKind = (typeof ANNOUNCEMENT_KINDS)[number];

export const ANNOUNCEMENT_TITLE_MAX = 60;
export const ANNOUNCEMENT_SUBTITLE_MAX = 120;
export const ANNOUNCEMENT_LINK_MAX = 300;
export const POLL_QUESTION_MAX = 120;
export const POLL_OPTION_MAX = 40;
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 4;

export type AnnouncementInput = {
  kind: AnnouncementKind;
  title: string;
  subtitle: string | null;
  /** An https address (where to listen to an episode) or a page of the app ("/…"). */
  link: string | null;
};

export type Announcement = AnnouncementInput & {
  id: string;
  /** ISO 8601. */
  publishedAt: string;
};

export type PollInput = {
  question: string;
  options: string[];
  /** ISO 8601. */
  closesAt: string;
};

export type Poll = PollInput & {
  id: string;
  /** The answer the player chose (0 for the first); null before their vote. */
  myChoice: number | null;
  /** One count per answer; null while the player may not read them (before voting, poll open). */
  votes: number[] | null;
};

/** A moment of one of my leagues, with the league it happened in. */
export type CommunityMoment = FeedMoment & { leagueId: string; leagueName: string };

export const isAnnouncementKind = (kind: string): kind is AnnouncementKind =>
  (ANNOUNCEMENT_KINDS as readonly string[]).includes(kind);
const isLink = (link: string) =>
  link.length <= ANNOUNCEMENT_LINK_MAX && (link.startsWith("https://") || link.startsWith("/"));

/**
 * The episode the podcast card of the home shows (#896): the latest published one (removed ones are
 * gone), null when there is none; the community block of the home then leaves episodes out.
 */
export function latestEpisode(announcements: Announcement[]): Announcement | null {
  return announcements.reduce<Announcement | null>(
    (latest, a) =>
      a.kind === "episode" &&
      (!latest || Date.parse(a.publishedAt) > Date.parse(latest.publishedAt))
        ? a
        : latest,
    null,
  );
}

/** An announcement as typed in the back-office, trimmed; refused when a field is out of bounds. */
export function checkAnnouncement(input: {
  kind: string;
  title: string;
  subtitle: string;
  link: string;
}): AnnouncementInput | "ANNOUNCEMENT_INVALID" {
  const title = input.title.trim();
  const subtitle = input.subtitle.trim() || null;
  const link = input.link.trim() || null;
  if (!isAnnouncementKind(input.kind)) return "ANNOUNCEMENT_INVALID";
  if (title.length === 0 || title.length > ANNOUNCEMENT_TITLE_MAX) return "ANNOUNCEMENT_INVALID";
  if (subtitle && subtitle.length > ANNOUNCEMENT_SUBTITLE_MAX) return "ANNOUNCEMENT_INVALID";
  if (link ? !isLink(link) : input.kind === "episode") return "ANNOUNCEMENT_INVALID";
  return { kind: input.kind, title, subtitle, link };
}

/**
 * A poll as typed in the back-office: a question, 2 to 4 distinct answers (the empty ones left
 * out), a closing date to come.
 */
export function checkPoll(input: PollInput, now: Date): PollInput | "POLL_INVALID" {
  const question = input.question.trim();
  const options = input.options.map((o) => o.trim()).filter((o) => o.length > 0);
  const closes = Date.parse(input.closesAt);
  if (question.length === 0 || question.length > POLL_QUESTION_MAX) return "POLL_INVALID";
  if (options.length < POLL_OPTIONS_MIN || options.length > POLL_OPTIONS_MAX) return "POLL_INVALID";
  if (options.some((o) => o.length > POLL_OPTION_MAX)) return "POLL_INVALID";
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return "POLL_INVALID";
  if (Number.isNaN(closes) || closes <= now.getTime()) return "POLL_INVALID";
  return { question, options, closesAt: input.closesAt };
}

/** Open: the player may vote; voted: they did, they see the results; closed: results for all. */
export function pollPhase(poll: Poll, now: Date): "open" | "voted" | "closed" {
  if (Date.parse(poll.closesAt) <= now.getTime()) return "closed";
  return poll.myChoice === null ? "open" : "voted";
}

/**
 * The votes of each answer and its share in whole percents. The shares add up to 100 once someone
 * voted (largest remainder; a tie goes to the first answer).
 */
export function pollResults(votes: number[]): {
  total: number;
  answers: { votes: number; percent: number }[];
} {
  const total = votes.reduce((sum, v) => sum + v, 0);
  if (total === 0) return { total, answers: votes.map((v) => ({ votes: v, percent: 0 })) };
  const exact = votes.map((v) => (v * 100) / total);
  const percents = exact.map(Math.floor);
  let left = 100 - percents.reduce((sum, p) => sum + p, 0);
  const byRemainder = exact
    .map((e, i) => ({ i, rest: e - Math.floor(e) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left === 0) break;
    percents[i] += 1;
    left -= 1;
  }
  return { total, answers: votes.map((v, i) => ({ votes: v, percent: percents[i] })) };
}

/**
 * The moments of several leagues in one list, latest first, each with its league; at most `limit`.
 * The order of the leagues changes nothing.
 */
export function communityMoments(
  feeds: { league: { id: string; name: string }; moments: FeedMoment[] }[],
  limit: number,
): CommunityMoment[] {
  return feeds
    .flatMap(({ league, moments }) =>
      moments.map((m) => ({ ...m, leagueId: league.id, leagueName: league.name })),
    )
    .sort(
      (a, b) =>
        b.happenedAt.localeCompare(a.happenedAt) ||
        a.leagueId.localeCompare(b.leagueId) ||
        a.key.localeCompare(b.key),
    )
    .slice(0, Math.max(0, limit));
}
