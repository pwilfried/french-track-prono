import { describe, expect, it } from "vitest";

import { badgesOf, type BadgeInput } from "./badges";

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
