import { describe, expect, it } from "vitest";

import type { EventSummary } from "./event";
import { leaguePredict } from "./league-predict";

const final = (slug: string, startsAt: string, lockAt = startsAt): EventSummary => ({
  id: slug,
  slug,
  discipline: "100 m",
  gender: "F",
  startsAt,
  lockAt,
  isFeatured: false,
  status: "upcoming",
  round: "final",
});
const now = new Date("2026-09-12T10:00:00Z");
const competitions = [
  { slug: "later", startsOn: "2026-11-27" },
  { slug: "past", startsOn: "2026-09-01" },
  { slug: "soon", startsOn: "2026-10-03" },
];

describe("leaguePredict (#1069)", () => {
  it("leads to the open final closest to its lock when it is the only one that day", () => {
    // given a final today and one tomorrow, none predicted
    const events = [
      final("tomorrow", "2026-09-13T18:00:00Z"),
      final("today", "2026-09-12T18:40:00Z"),
    ];
    // when the league asks for the next prediction
    const call = leaguePredict({ events, predicted: new Set(), competitions, now });
    // then it is today's final, alone
    expect(call).toEqual({ kind: "predict", finals: [events[1]] });
  });

  it("lists the open finals of the same day left to predict, in start order", () => {
    const events = [
      final("late", "2026-09-12T20:00:00Z"),
      final("early", "2026-09-12T18:00:00Z"),
      final("posed", "2026-09-12T19:00:00Z"),
      final("tomorrow", "2026-09-13T18:00:00Z"),
    ];
    const call = leaguePredict({ events, predicted: new Set(["posed"]), competitions, now });
    expect(call).toEqual({ kind: "predict", finals: [events[1], events[0]] });
  });

  it("skips finals already locked and rounds that are not finals", () => {
    const heat = { ...final("heat", "2026-09-12T12:00:00Z"), round: "series" as const };
    const events = [
      final("locked", "2026-09-12T09:00:00Z"),
      heat,
      final("open", "2026-09-14T18:00:00Z"),
    ];
    const call = leaguePredict({ events, predicted: new Set(), competitions, now });
    expect(call).toEqual({ kind: "predict", finals: [events[2]] });
  });

  it("says every open podium is posed, with how many and the first lock", () => {
    const events = [
      final("a", "2026-09-12T20:00:00Z"),
      final("b", "2026-09-12T18:40:00Z"),
      final("locked", "2026-09-12T08:00:00Z"),
    ];
    const call = leaguePredict({ events, predicted: new Set(["a", "b"]), competitions, now });
    expect(call).toEqual({ kind: "done", posed: 2, first: events[1] });
  });

  it("gives the next competition of the league when no final is open", () => {
    const events = [final("locked", "2026-09-12T08:00:00Z")];
    const call = leaguePredict({ events, predicted: new Set(), competitions, now });
    expect(call).toEqual({ kind: "next", competition: competitions[2] });
  });

  it("gives nothing when no final is open and no competition is to come", () => {
    const call = leaguePredict({
      events: [],
      predicted: new Set(),
      competitions: [{ slug: "past", startsOn: "2026-09-01" }],
      now,
    });
    expect(call).toBeNull();
  });
});
