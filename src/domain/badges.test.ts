import { describe, expect, it } from "vitest";

import { badgeProgress, badgesOf, nextBadge, type BadgeInput } from "./badges";

const at = (day: number) => `2026-11-2${day}T19:00:00Z`;
const base: BadgeInput = {
  myLines: [],
  computedEvents: [],
  frenchWinnerEvents: new Set(),
  days: [],
  predictedEventIds: new Set(),
};

describe("badgesOf", () => {
  it("gives nothing to a new player", () => {
    expect(badgesOf(base)).toEqual([]);
  });

  it("gives Nostradamus for a perfect podium, Flair for a coup de flair", () => {
    const badges = badgesOf({
      ...base,
      myLines: [
        { eventId: "e1", eventStartsAt: at(3), points: 12, reasons: [{ kind: "perfect_podium" }] },
        { eventId: "e2", eventStartsAt: at(4), points: 5, reasons: [{ kind: "flair" }] },
      ],
    });
    expect(badges).toEqual(["nostradamus", "flair"]);
  });

  it("gives Chasseur from 3 winners found", () => {
    const winner = (eventId: string) => ({
      eventId,
      eventStartsAt: at(3),
      points: 3,
      reasons: [{ kind: "exact" as const, slot: 1 as const }],
    });
    expect(badgesOf({ ...base, myLines: [winner("a"), winner("b")] })).toEqual([]);
    expect(badgesOf({ ...base, myLines: [winner("a"), winner("b"), winner("c")] })).toEqual([
      "chasseur",
    ]);
  });

  it("gives Série for 5 computed events in a row with points, at any time", () => {
    const ids = ["e1", "e2", "e3", "e4", "e5", "e6"];
    const computedEvents = ids.map((eventId, i) => ({ eventId, startsAt: at(i) }));
    const myLines = ids
      .slice(0, 5)
      .map((eventId, i) => ({ eventId, eventStartsAt: at(i), points: 1, reasons: [] }));
    expect(badgesOf({ ...base, computedEvents, myLines })).toEqual(["serie"]);
    expect(badgesOf({ ...base, computedEvents, myLines: myLines.slice(1) })).toEqual([]);
  });

  it("gives Bleus when a French winner was found, Fidèle for a full day of predictions", () => {
    expect(badgesOf({ ...base, frenchWinnerEvents: new Set(["e1"]) })).toEqual(["bleus"]);
    expect(
      badgesOf({
        ...base,
        days: [["a", "b"], ["c"]],
        predictedEventIds: new Set(["a", "c"]),
      }),
    ).toEqual(["fidele"]);
    expect(badgesOf({ ...base, days: [["a", "b"]], predictedEventIds: new Set(["a"]) })).toEqual(
      [],
    );
  });
});

describe("badgeProgress", () => {
  const of = (input: BadgeInput) =>
    Object.fromEntries(badgeProgress(input).map((p) => [p.badge, [p.current, p.target]]));
  const winner = (eventId: string, startsAt: string) => ({
    eventId,
    eventStartsAt: startsAt,
    points: 3,
    reasons: [{ kind: "exact" as const, slot: 1 as const }],
  });

  it("lists every badge in display order, all at zero for a new player", () => {
    expect(badgeProgress(base).map((p) => p.badge)).toEqual([
      "nostradamus",
      "chasseur",
      "flair",
      "serie",
      "bleus",
      "fidele",
    ]);
    expect(badgeProgress(base).every((p) => p.current === 0 && p.target > 0)).toBe(true);
  });

  it("counts winners found and caps at the target", () => {
    const lines = ["a", "b", "c", "d"].map((id) => winner(id, at(3)));
    expect(of({ ...base, myLines: lines.slice(0, 2) }).chasseur).toEqual([2, 3]);
    expect(of({ ...base, myLines: lines }).chasseur).toEqual([3, 3]);
  });

  it("counts the ongoing run for Série until it is earned", () => {
    const ids = ["e1", "e2", "e3", "e4", "e5"];
    const computedEvents = ids.map((eventId, i) => ({ eventId, startsAt: at(i) }));
    const line = (eventId: string, i: number, points: number) => ({
      eventId,
      eventStartsAt: at(i),
      points,
      reasons: [],
    });
    // 3 in a row, then a miss, then 1: the next streak starts again from 1.
    const myLines = [line("e1", 0, 1), line("e2", 1, 1), line("e3", 2, 1), line("e5", 4, 1)];
    expect(of({ ...base, computedEvents, myLines }).serie).toEqual([1, 5]);
  });

  it("follows the day closest to being fully predicted for Fidèle", () => {
    const input = {
      ...base,
      days: [
        ["a", "b", "c"],
        ["d", "e"],
      ],
      predictedEventIds: new Set(["a", "d"]),
    };
    expect(of(input).fidele).toEqual([1, 2]);
  });

  it("always agrees with badgesOf", () => {
    const input = { ...base, myLines: [winner("a", at(3))], frenchWinnerEvents: new Set(["a"]) };
    const earned = badgeProgress(input).filter((p) => p.current >= p.target);
    expect(earned.map((p) => p.badge)).toEqual(badgesOf(input));
  });
});

describe("nextBadge", () => {
  it("picks the locked badge with the fewest steps left, display order breaking ties", () => {
    expect(
      nextBadge([
        { badge: "nostradamus", current: 0, target: 1 },
        { badge: "chasseur", current: 2, target: 3 },
        { badge: "flair", current: 1, target: 1 },
        { badge: "serie", current: 4, target: 5 },
      ]),
    ).toEqual({ badge: "nostradamus", current: 0, target: 1, left: 1 });
  });

  it("returns null once every badge is earned", () => {
    expect(nextBadge([{ badge: "flair", current: 1, target: 1 }])).toBeNull();
  });
});
