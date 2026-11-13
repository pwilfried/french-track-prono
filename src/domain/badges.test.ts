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

describe("badge progress", () => {
  const winner = (id: string, day: number) => ({
    eventId: id,
    eventStartsAt: at(day),
    points: 5,
    reasons: [{ kind: "exact" as const, slot: 1 as const }],
  });

  it("says how far each locked badge is", () => {
    const progress = badgeProgress({
      ...base,
      myLines: [winner("e1", 1), winner("e2", 2)],
      computedEvents: [
        { eventId: "e1", startsAt: at(1) },
        { eventId: "e2", startsAt: at(2) },
      ],
      days: [["e1", "e2", "e3"], ["e4"]],
      predictedEventIds: new Set(["e1", "e2"]),
    });
    expect(Object.fromEntries(progress.map((b) => [b.badge, [b.progress, b.goal]]))).toEqual({
      nostradamus: [0, 1],
      chasseur: [2, 3],
      flair: [0, 1],
      serie: [2, 5],
      bleus: [0, 1],
      fidele: [2, 3],
    });
  });

  it("points to the badge with the fewest steps left, the display order on a tie", () => {
    const progress = badgeProgress({
      ...base,
      myLines: [winner("e1", 1), winner("e2", 2)],
      computedEvents: [
        { eventId: "e1", startsAt: at(1) },
        { eventId: "e2", startsAt: at(2) },
      ],
    });
    expect(nextBadge(progress)?.badge).toBe("nostradamus");
    const earnedAll = progress.map((b) => ({ ...b, earned: true }));
    expect(nextBadge(earnedAll)).toBeNull();
  });

  it("keeps the progress between 0 and the goal", () => {
    const progress = badgeProgress({
      ...base,
      myLines: [1, 2, 3, 4, 5, 6, 7].map((d) => winner(`e${d}`, d)),
      computedEvents: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ eventId: `e${d}`, startsAt: at(d) })),
    });
    for (const b of progress) expect(b.progress).toBeLessThanOrEqual(b.goal);
    expect(progress.find((b) => b.badge === "chasseur")).toMatchObject({
      earned: true,
      progress: 3,
    });
  });
});
