import {
  checkAnnouncement,
  checkPoll,
  communityMoments,
  type Announcement,
  type AnnouncementInput,
  type CommunityMoment,
  type Poll,
  type PollInput,
} from "@/domain/community";
import { challengeMoments, type ChallengeMoment } from "@/domain/frenchtrack";

import { UseCaseError } from "./errors";
import type { FrenchTrackRepository } from "./frenchtrack";
import type { LeagueMomentRepository } from "./league-moments";

/** Why a vote is refused; anything else is « voted ». */
export type VoteOutcome = "voted" | "already_voted" | "closed" | "not_found" | "invalid";

/**
 * Port: the FrenchTrack announcements and the polls (#673). Real adapter = Supabase (the admin
 * publishes, a player reads and votes), fake = in memory.
 */
export interface CommunityRepository {
  /** Latest first. */
  announcements(): Promise<Announcement[]>;
  /** The open polls and those closed lately, latest first; the votes only once readable. */
  polls(): Promise<Poll[]>;
  vote(pollId: string, choice: number): Promise<VoteOutcome>;
  /** Admin only; returns the id. */
  publishAnnouncement(announcement: AnnouncementInput): Promise<string | "not_admin">;
  removeAnnouncement(id: string): Promise<"removed" | "not_admin">;
  /** Admin only; returns the id. */
  createPoll(poll: PollInput): Promise<string | "not_admin">;
  removePoll(id: string): Promise<"removed" | "not_admin">;
}

export type Community = {
  moments: CommunityMoment[];
  /** « Battez FrenchTrack »: the computed challenges of the season, latest computed first. */
  challenges: ChallengeMoment[];
  announcements: Announcement[];
  polls: Poll[];
};

/**
 * The « Dans ma communauté » block: the latest moments of all my leagues in one list, latest
 * first, each with the name of its league; the « Battez FrenchTrack » challenges of the season
 * once computed (#877); the announcements and the polls.
 */
export function getCommunity(ports: {
  moments: Pick<LeagueMomentRepository, "feed">;
  community: CommunityRepository;
  frenchTrack: Pick<FrenchTrackRepository, "challenges">;
}) {
  return {
    async execute(input: {
      leagues: { id: string; name: string }[];
      momentLimit: number;
      /** The season of the challenges (calendar year, Paris time). */
      year: number;
    }): Promise<Community> {
      const [feeds, challenges, announcements, polls] = await Promise.all([
        Promise.all(
          input.leagues.map(async (league) => ({
            league,
            moments: await ports.moments.feed(league.id),
          })),
        ),
        ports.frenchTrack.challenges(input.year),
        ports.community.announcements(),
        ports.community.polls(),
      ]);
      return {
        moments: communityMoments(feeds, input.momentLimit),
        challenges: challengeMoments(challenges, input.momentLimit),
        announcements,
        polls,
      };
    },
  };
}

const VOTE_ERRORS = {
  already_voted: "POLL_ALREADY_VOTED",
  closed: "POLL_CLOSED",
  not_found: "POLL_NOT_FOUND",
  invalid: "POLL_INVALID",
} as const;

/** The signed-in player votes once, for one answer of an open poll. */
export function voteInPoll(ports: { community: CommunityRepository }) {
  return {
    async execute(input: { pollId: string; choice: number }): Promise<void> {
      if (!Number.isInteger(input.choice) || input.choice < 0) {
        throw new UseCaseError("POLL_INVALID");
      }
      const outcome = await ports.community.vote(input.pollId, input.choice);
      if (outcome !== "voted") throw new UseCaseError(VOTE_ERRORS[outcome]);
    },
  };
}

/** The admin publishes an announcement: a kind, a short title and subtitle, a link. */
export function publishAnnouncement(ports: { community: CommunityRepository }) {
  return {
    async execute(input: {
      kind: string;
      title: string;
      subtitle: string;
      link: string;
    }): Promise<string> {
      const announcement = checkAnnouncement(input);
      if (announcement === "ANNOUNCEMENT_INVALID") throw new UseCaseError(announcement);
      const id = await ports.community.publishAnnouncement(announcement);
      if (id === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return id;
    },
  };
}

/** The admin creates a poll: a question, 2 to 4 answers, a closing date to come. */
export function createPoll(ports: { community: CommunityRepository; now?: () => Date }) {
  const now = ports.now ?? (() => new Date());
  return {
    async execute(input: PollInput): Promise<string> {
      const poll = checkPoll(input, now());
      if (poll === "POLL_INVALID") throw new UseCaseError(poll);
      const id = await ports.community.createPoll(poll);
      if (id === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return id;
    },
  };
}

/** The admin removes an announcement: it disappears for everybody. */
export function removeAnnouncement(ports: { community: CommunityRepository }) {
  return {
    async execute(input: { id: string }): Promise<void> {
      if ((await ports.community.removeAnnouncement(input.id)) === "not_admin") {
        throw new UseCaseError("NOT_ADMIN");
      }
    },
  };
}

/** The admin removes a poll, its votes with it. */
export function removePoll(ports: { community: CommunityRepository }) {
  return {
    async execute(input: { id: string }): Promise<void> {
      if ((await ports.community.removePoll(input.id)) === "not_admin") {
        throw new UseCaseError("NOT_ADMIN");
      }
    },
  };
}
