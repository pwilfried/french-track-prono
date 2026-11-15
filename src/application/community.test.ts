import { describe, expect, it } from "vitest";

import type { Announcement, Poll } from "@/domain/community";
import type { FeedMoment } from "@/domain/league-moments";
import { DEFAULT_RULES } from "@/domain/scoring";

import {
  createPoll,
  getCommunity,
  publishAnnouncement,
  voteInPoll,
  type CommunityRepository,
  type VoteOutcome,
} from "./community";
import { computeEventPoints, type PointsRepository } from "./compute-event-points";
import { UseCaseError } from "./errors";
import type { ChallengeSummary, FrenchTrackRepository } from "./frenchtrack";

const NOW = new Date("2026-11-15T12:00:00.000Z");

const moment = (key: string, happenedAt: string): FeedMoment => ({
  key,
  kind: "perfect_podium",
  happenedAt,
  pseudo: "Ana",
});

/**
 * A small fake of the port: what it holds, and what it was asked to publish. Without `admin`, it
 * refuses the admin's writes like the database does. The whole port is checked by its contract
 * (src/infra/contract/community.contract.ts).
 */
function fakeCommunity(world: {
  admin?: boolean;
  announcements?: Announcement[];
  polls?: Poll[];
  vote?: VoteOutcome;
}) {
  const published: unknown[] = [];
  const repository: CommunityRepository = {
    announcements: async () => world.announcements ?? [],
    polls: async () => world.polls ?? [],
    vote: async () => world.vote ?? "voted",
    publishAnnouncement: async (a) => (world.admin ? (published.push(a), "a1") : "not_admin"),
    removeAnnouncement: async () => (world.admin ? "removed" : "not_admin"),
    createPoll: async (p) => (world.admin ? (published.push(p), "p1") : "not_admin"),
    removePoll: async () => (world.admin ? "removed" : "not_admin"),
  };
  return { repository, published };
}

const noChallenge = { challenges: async () => [] };

/**
 * A small fake of the FrenchTrack port around one challenge, the 100 m F: like the database, it
 * dates the challenge by the first computation of its points (the whole port is checked by its
 * contract, src/infra/contract/frenchtrack-repository.contract.ts).
 */
function fakeChallenge(clock: { now: Date }) {
  const challenge: ChallengeSummary = {
    eventId: "e1",
    slug: "100m-f",
    discipline: "100 m",
    gender: "F",
    startsAt: "2026-08-12T19:00:00.000Z",
    lockAt: "2026-08-12T19:00:00.000Z",
    points: null,
    mine: null,
    scoredAt: null,
    scores: [],
  };
  const podium = { first: "a", second: "b", third: "c" };
  const frenchTrack: FrenchTrackRepository = {
    challenge: async () => ({
      locked: true,
      podium,
      points: challenge.points,
      mine: challenge.mine,
      scores: challenge.scores,
    }),
    challenges: async () => [{ ...challenge }],
    season: async () => [],
    savePick: async () => "saved",
    removePick: async () => "removed",
    saveScore: async (_, points) => {
      challenge.points = points;
      challenge.scoredAt ??= clock.now.toISOString();
      // The players' points of the event, mine first: 3 of the 4 beat FrenchTrack's 5.
      challenge.mine = 9;
      challenge.scores = [2, 9, 12, 25];
      return "saved";
    },
  };
  return frenchTrack;
}

const result: PointsRepository = {
  loadEvent: async () => ({
    lockAt: "2026-08-12T19:00:00.000Z",
    results: [
      { athleteId: "a", rank: 1 },
      { athleteId: "c", rank: 2 },
      { athleteId: "b", rank: 3 },
    ],
    predictions: [],
    rules: DEFAULT_RULES,
  }),
  findEventScores: async () => [],
  progress: async () => ({ withResult: [], scored: [] }),
  listMine: async () => [],
  replaceEventScores: async () => "saved",
};

describe("the Battez FrenchTrack moment of the community block", () => {
  const openCommunity = (frenchTrack: FrenchTrackRepository) =>
    getCommunity({
      moments: { feed: async () => [] },
      community: fakeCommunity({}).repository,
      frenchTrack,
    }).execute({ leagues: [], momentLimit: 3, year: 2026 });

  it("tells nothing of a challenge before its points are computed", async () => {
    // Given a locked challenge whose points are not computed yet
    const frenchTrack = fakeChallenge({ now: new Date("2026-08-12T20:00:00.000Z") });

    // When I open the home
    const block = await openCommunity(frenchTrack);

    // Then no FrenchTrack moment shows
    expect(block.challenges).toEqual([]);
  });

  it("tells the challenge once computed, dated by the computation, and only once when computed again", async () => {
    // Given a challenge on the 100 m F, computed by the admin at 21:00, then again at 22:00
    const clock = { now: new Date("2026-08-12T21:00:00.000Z") };
    const frenchTrack = fakeChallenge(clock);
    const compute = () =>
      computeEventPoints({ points: result, frenchTrack, now: () => clock.now }).execute({
        eventId: "e1",
      });
    await compute();
    clock.now = new Date("2026-08-12T22:00:00.000Z");
    await compute();

    // When I open the home
    const block = await openCommunity(frenchTrack);

    // Then one moment tells the event, the share of players who beat FrenchTrack and my verdict
    expect(block.challenges).toEqual([
      {
        key: "frenchtrack:e1",
        eventId: "e1",
        slug: "100m-f",
        discipline: "100 m",
        gender: "F",
        happenedAt: "2026-08-12T21:00:00.000Z",
        beaten: { count: 3, percent: 75 },
        verdict: "won",
      },
    ]);
  });
});

describe("the community block", () => {
  it("merges the moments of my leagues, latest first, with the name of each league", async () => {
    // Given moments in each of my two leagues, on several evenings
    const feeds: Record<string, FeedMoment[]> = {
      friends: [moment("perfect_podium:e1:ana", "2026-11-13T19:00:00.000Z")],
      office: [
        moment("perfect_podium:e2:ana", "2026-11-14T19:00:00.000Z"),
        moment("streak:e0:ana", "2026-11-10T19:00:00.000Z"),
      ],
    };
    const moments = { feed: async (leagueId: string) => feeds[leagueId] ?? [] };

    // When I open the home, which shows two moments
    const block = await getCommunity({
      moments,
      community: fakeCommunity({}).repository,
      frenchTrack: noChallenge,
    }).execute({
      year: 2026,
      leagues: [
        { id: "friends", name: "Les amis" },
        { id: "office", name: "Le bureau" },
      ],
      momentLimit: 2,
    });

    // Then the latest two come first, each with its league
    expect(block.moments.map((m) => [m.key, m.leagueName])).toEqual([
      ["perfect_podium:e2:ana", "Le bureau"],
      ["perfect_podium:e1:ana", "Les amis"],
    ]);
  });

  it("shows the announcements and the polls next to the moments", async () => {
    const announcement: Announcement = {
      id: "a1",
      kind: "schedule",
      title: "Le programme de Paris",
      subtitle: null,
      link: null,
      publishedAt: NOW.toISOString(),
    };
    const poll: Poll = {
      id: "p1",
      question: "Qui gagne ?",
      options: ["A", "B"],
      closesAt: "2026-11-16T12:00:00.000Z",
      myChoice: null,
      votes: null,
    };
    const block = await getCommunity({
      moments: { feed: async () => [] },
      community: fakeCommunity({ announcements: [announcement], polls: [poll] }).repository,
      frenchTrack: noChallenge,
    }).execute({ leagues: [], momentLimit: 3, year: 2026 });
    expect(block).toEqual({
      moments: [],
      challenges: [],
      announcements: [announcement],
      polls: [poll],
    });
  });
});

describe("publishing", () => {
  it("refuses an announcement or a poll from a player who is not an admin", async () => {
    const { repository } = fakeCommunity({ admin: false });
    await expect(
      publishAnnouncement({ community: repository }).execute({
        kind: "schedule",
        title: "Programme",
        subtitle: "",
        link: "",
      }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
    await expect(
      createPoll({ community: repository, now: () => NOW }).execute({
        question: "Qui ?",
        options: ["A", "B"],
        closesAt: "2026-11-16T12:00:00.000Z",
      }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });

  it("refuses an announcement or a poll out of bounds before reaching the store", async () => {
    const { repository, published } = fakeCommunity({ admin: true });
    await expect(
      publishAnnouncement({ community: repository }).execute({
        kind: "episode",
        title: "Épisode sans lien",
        subtitle: "",
        link: "",
      }),
    ).rejects.toEqual(new UseCaseError("ANNOUNCEMENT_INVALID"));
    await expect(
      createPoll({ community: repository, now: () => NOW }).execute({
        question: "Qui ?",
        options: ["A"],
        closesAt: "2026-11-16T12:00:00.000Z",
      }),
    ).rejects.toEqual(new UseCaseError("POLL_INVALID"));
    expect(published).toEqual([]);
  });

  it("publishes a poll with its answers trimmed, the empty ones left out", async () => {
    const { repository, published } = fakeCommunity({ admin: true });
    await createPoll({ community: repository, now: () => NOW }).execute({
      question: "Qui gagne ?",
      options: [" Alpha", "Bravo ", "", ""],
      closesAt: "2026-11-16T12:00:00.000Z",
    });
    expect(published).toEqual([
      {
        question: "Qui gagne ?",
        options: ["Alpha", "Bravo"],
        closesAt: "2026-11-16T12:00:00.000Z",
      },
    ]);
  });
});

describe("voting", () => {
  it.each([
    ["already_voted", "POLL_ALREADY_VOTED"],
    ["closed", "POLL_CLOSED"],
    ["not_found", "POLL_NOT_FOUND"],
    ["invalid", "POLL_INVALID"],
  ] as const)("tells a refused vote (%s) by its code", async (outcome, code) => {
    const vote = voteInPoll({ community: fakeCommunity({ vote: outcome }).repository });
    await expect(vote.execute({ pollId: "p1", choice: 0 })).rejects.toEqual(new UseCaseError(code));
  });

  it("refuses an answer that is not a number before reaching the store", async () => {
    const vote = voteInPoll({ community: fakeCommunity({}).repository });
    await expect(vote.execute({ pollId: "p1", choice: Number.NaN })).rejects.toEqual(
      new UseCaseError("POLL_INVALID"),
    );
    await expect(vote.execute({ pollId: "p1", choice: 1 })).resolves.toBeUndefined();
  });
});
