import type { CommunityTrend } from "@/application/community-trend";
import type { Announcement, Poll } from "@/domain/community";
import type { ChallengeMoment } from "@/domain/frenchtrack";

/** Invented announcements and polls for the stories of the community block (#673). */
export const NOW = new Date("2026-11-15T12:00:00.000Z");

export const episode: Announcement = {
  id: "a1",
  kind: "episode",
  title: "Épisode 42 : la nuit des finales",
  subtitle: "Nos pronos pour le 100 m et le saut à la perche",
  link: "https://example.test/episode-42",
  publishedAt: "2026-11-15T08:00:00.000Z",
};

export const competitionOpen: Announcement = {
  id: "a2",
  kind: "competition_open",
  title: "Le Meeting de Paris est ouvert",
  subtitle: "Les pronos des 12 finales sont ouverts",
  link: "/competitions",
  publishedAt: "2026-11-14T08:00:00.000Z",
};

export const poll: Poll = {
  id: "p1",
  question: "Qui gagne le 100 m ce soir ?",
  options: ["Alpha", "Bravo", "Charlie"],
  closesAt: "2026-11-16T19:00:00.000Z",
  myChoice: null,
  votes: null,
};

export const votedPoll: Poll = { ...poll, myChoice: 1, votes: [3, 6, 1] };

/** A computed « Battez FrenchTrack » challenge (#877). */
export const challenge: ChallengeMoment = {
  key: "frenchtrack:e1",
  eventId: "e1",
  slug: "meeting-de-paris-100m-f",
  discipline: "100 m",
  gender: "F",
  happenedAt: "2026-11-14T21:00:00.000Z",
  beaten: { count: 42, percent: 42 },
  verdict: "won",
};

/** The prediction trend of the last locked event, before its result (#1080). */
export const trend: CommunityTrend = {
  slug: "meeting-de-paris-100m-f",
  discipline: "100 m",
  gender: "F",
  total: 128,
  favourite: { athleteId: "a1", name: "Alpha Bravo", percent: 62 },
  result: null,
};

/** The same trend once the result is in. */
export const trendWithResult: CommunityTrend = {
  ...trend,
  result: { favouriteWon: true, perfectPercent: 8 },
};
