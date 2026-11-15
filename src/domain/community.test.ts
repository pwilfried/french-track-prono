import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  checkAnnouncement,
  checkPoll,
  communityMoments,
  latestEpisode,
  pollPhase,
  type Announcement,
  pollResults,
  type Poll,
} from "./community";
import type { FeedMoment } from "./league-moments";

const NOW = new Date("2026-11-15T12:00:00.000Z");

const moment = (key: string, happenedAt: string): FeedMoment => ({
  key,
  kind: "perfect_podium",
  happenedAt,
  pseudo: key,
});

describe("communityMoments", () => {
  it("merges the moments of several leagues, latest first, each with its league", () => {
    const merged = communityMoments(
      [
        {
          league: { id: "a", name: "Amis" },
          moments: [moment("a1", "2026-11-14T19:00:00Z"), moment("a2", "2026-11-12T19:00:00Z")],
        },
        { league: { id: "b", name: "Bureau" }, moments: [moment("b1", "2026-11-13T19:00:00Z")] },
      ],
      10,
    );
    expect(merged.map((m) => [m.key, m.leagueName])).toEqual([
      ["a1", "Amis"],
      ["b1", "Bureau"],
      ["a2", "Amis"],
    ]);
  });

  it("keeps only the latest moments up to the limit", () => {
    const merged = communityMoments(
      [
        { league: { id: "a", name: "A" }, moments: [moment("old", "2026-11-01T19:00:00Z")] },
        { league: { id: "b", name: "B" }, moments: [moment("new", "2026-11-14T19:00:00Z")] },
      ],
      1,
    );
    expect(merged.map((m) => m.key)).toEqual(["new"]);
  });

  it("does not depend on the order of the leagues", () => {
    const feeds = [
      { league: { id: "a", name: "A" }, moments: [moment("x", "2026-11-14T19:00:00Z")] },
      { league: { id: "b", name: "B" }, moments: [moment("x", "2026-11-14T19:00:00Z")] },
    ];
    expect(communityMoments(feeds, 10)).toEqual(communityMoments([...feeds].reverse(), 10));
  });
});

const announcement = (
  id: string,
  kind: Announcement["kind"],
  publishedAt: string,
): Announcement => ({
  id,
  kind,
  title: id,
  subtitle: null,
  link: "https://example.test/" + id,
  publishedAt,
});

describe("latestEpisode", () => {
  it("picks the latest episode, whatever the order and the other announcements", () => {
    const old = announcement("old", "episode", "2026-11-10T08:00:00.000Z");
    const recent = announcement("recent", "episode", "2026-11-14T08:00:00.000Z");
    const newer = announcement("newer", "schedule", "2026-11-15T08:00:00.000Z");
    expect(latestEpisode([old, newer, recent])).toBe(recent);
    expect(latestEpisode([recent, old])).toBe(recent);
  });

  it("is null without an episode", () => {
    expect(latestEpisode([])).toBeNull();
    expect(latestEpisode([announcement("a", "schedule", "2026-11-15T08:00:00.000Z")])).toBeNull();
  });
});

describe("checkAnnouncement", () => {
  it("accepts a new episode with where to listen to it, trimmed", () => {
    expect(
      checkAnnouncement({
        kind: "episode",
        title: "  Épisode 42 ",
        subtitle: "",
        link: "https://example.test/42",
      }),
    ).toEqual({
      kind: "episode",
      title: "Épisode 42",
      subtitle: null,
      link: "https://example.test/42",
    });
  });

  it.each([
    ["an episode without a link", { kind: "episode", title: "Épisode", subtitle: "", link: "" }],
    ["an empty title", { kind: "schedule", title: " ", subtitle: "", link: "" }],
    ["a title too long", { kind: "schedule", title: "x".repeat(61), subtitle: "", link: "" }],
    [
      "a subtitle too long",
      { kind: "schedule", title: "Programme", subtitle: "x".repeat(121), link: "" },
    ],
    ["an unknown kind", { kind: "chat", title: "Salut", subtitle: "", link: "" }],
    [
      "a link that is not https",
      { kind: "schedule", title: "Programme", subtitle: "", link: "http://x.test" },
    ],
  ])("refuses %s", (_, input) => {
    expect(checkAnnouncement(input)).toBe("ANNOUNCEMENT_INVALID");
  });

  it("accepts a page of the app as link", () => {
    expect(
      checkAnnouncement({
        kind: "competition_open",
        title: "Paris",
        subtitle: "",
        link: "/competitions/paris",
      }),
    ).toMatchObject({ link: "/competitions/paris" });
  });
});

describe("checkPoll", () => {
  const later = "2026-11-16T12:00:00.000Z";

  it("keeps the answers given, trimmed, and leaves out the empty ones", () => {
    expect(
      checkPoll(
        { question: " Qui gagne ? ", options: ["Alpha ", "", "Bravo", ""], closesAt: later },
        NOW,
      ),
    ).toEqual({ question: "Qui gagne ?", options: ["Alpha", "Bravo"], closesAt: later });
  });

  it.each([
    ["one answer", { question: "Qui ?", options: ["A"], closesAt: later }],
    ["five answers", { question: "Qui ?", options: ["A", "B", "C", "D", "E"], closesAt: later }],
    ["the same answer twice", { question: "Qui ?", options: ["A", "a"], closesAt: later }],
    ["an answer too long", { question: "Qui ?", options: ["A", "x".repeat(41)], closesAt: later }],
    ["an empty question", { question: "", options: ["A", "B"], closesAt: later }],
    [
      "a closing date already past",
      { question: "Qui ?", options: ["A", "B"], closesAt: "2026-11-15T11:00:00.000Z" },
    ],
    [
      "a closing date that is not a date",
      { question: "Qui ?", options: ["A", "B"], closesAt: "demain" },
    ],
  ])("refuses %s", (_, input) => {
    expect(checkPoll(input, NOW)).toBe("POLL_INVALID");
  });
});

const poll = (over: Partial<Poll> = {}): Poll => ({
  id: "p",
  question: "Qui gagne ?",
  options: ["Alpha", "Bravo"],
  closesAt: "2026-11-16T12:00:00.000Z",
  myChoice: null,
  votes: null,
  ...over,
});

describe("pollPhase", () => {
  it("is open until the player votes, then voted, then closed at its date", () => {
    expect(pollPhase(poll(), NOW)).toBe("open");
    expect(pollPhase(poll({ myChoice: 0, votes: [1, 0] }), NOW)).toBe("voted");
    expect(pollPhase(poll({ closesAt: "2026-11-15T12:00:00.000Z" }), NOW)).toBe("closed");
  });
});

describe("pollResults", () => {
  it("gives each answer its votes and its share, the total making 100", () => {
    expect(pollResults([1, 1, 1])).toEqual({
      total: 3,
      answers: [
        { votes: 1, percent: 34 },
        { votes: 1, percent: 33 },
        { votes: 1, percent: 33 },
      ],
    });
  });

  it("gives 0 % to every answer when nobody voted", () => {
    expect(pollResults([0, 0])).toEqual({
      total: 0,
      answers: [
        { votes: 0, percent: 0 },
        { votes: 0, percent: 0 },
      ],
    });
  });

  it("always shares 100 % between the answers once someone voted", () => {
    fc.assert(
      fc.property(fc.array(fc.nat(1000), { minLength: 2, maxLength: 4 }), (votes) => {
        const { total, answers } = pollResults(votes);
        const sum = answers.reduce((s, a) => s + a.percent, 0);
        expect(sum).toBe(total === 0 ? 0 : 100);
        expect(answers.every((a) => a.percent >= 0 && a.percent <= 100)).toBe(true);
      }),
    );
  });
});
