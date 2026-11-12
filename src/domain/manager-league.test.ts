import { describe, expect, it } from "vitest";

import {
  canLaunchMercato,
  isAllowedTarget,
  isPlayerTarget,
  isRoundHours,
  mercatoRounds,
  opensAutomatically,
  playersAwaited,
  playerTargets,
} from "./manager-league";

describe("isPlayerTarget", () => {
  it.each([4, 6, 8, 10])("accepts %i players", (n) => {
    expect(isPlayerTarget(n)).toBe(true);
  });

  it.each([0, 2, 3, 5, 7, 9, 11, 12, 4.5, Number.NaN])("refuses %d players", (n) => {
    expect(isPlayerTarget(n)).toBe(false);
  });
});

describe("isAllowedTarget", () => {
  it("never goes under the players already in", () => {
    expect(isAllowedTarget(4, 5)).toBe(false);
    expect(isAllowedTarget(6, 5)).toBe(true);
    expect(isAllowedTarget(6, 6)).toBe(true);
  });

  it("offers the even counts from the players already in up to 10", () => {
    expect(playerTargets(1)).toEqual([4, 6, 8, 10]);
    expect(playerTargets(5)).toEqual([6, 8, 10]);
    expect(playerTargets(10)).toEqual([10]);
  });
});

const league = { target: 4, members: 4, openedAt: null, startsAt: null };

describe("canLaunchMercato", () => {
  it("lets the creator launch once the players are all in", () => {
    expect(canLaunchMercato(league, true)).toBe(true);
  });

  it("does not let another participant launch", () => {
    expect(canLaunchMercato(league, false)).toBe(false);
  });

  it("waits while players are missing", () => {
    expect(canLaunchMercato({ ...league, members: 3 }, true)).toBe(false);
    expect(playersAwaited({ ...league, members: 3 })).toBe(1);
  });

  it("does not launch a mercato twice", () => {
    expect(canLaunchMercato({ ...league, openedAt: "2027-01-01T08:00:00Z" }, true)).toBe(false);
  });
});

describe("opensAutomatically", () => {
  const scheduled = { ...league, startsAt: "2027-01-01T08:00:00.000Z" };

  it("opens at the chosen time when the players are all in", () => {
    expect(opensAutomatically(scheduled, "2027-01-01T08:00:00.000Z")).toBe(true);
    expect(opensAutomatically(scheduled, "2027-01-02T08:00:00.000Z")).toBe(true);
  });

  it("does not open before the chosen time", () => {
    expect(opensAutomatically(scheduled, "2027-01-01T07:59:00.000Z")).toBe(false);
  });

  it("waits past the chosen time while players are missing", () => {
    expect(opensAutomatically({ ...scheduled, members: 3 }, "2027-01-02T08:00:00.000Z")).toBe(
      false,
    );
  });

  it("does not open without a chosen time, nor twice", () => {
    expect(opensAutomatically(league, "2027-01-02T08:00:00.000Z")).toBe(false);
    expect(
      opensAutomatically(
        { ...scheduled, openedAt: "2027-01-01T08:00:00.000Z" },
        "2027-01-02T08:00:00.000Z",
      ),
    ).toBe(false);
  });
});

describe("mercatoRounds", () => {
  const frenchTrack = { firstHours: 24, longRounds: 1, nextHours: 24 };

  it("follows the French Track rules in automatic mode", () => {
    expect(mercatoRounds({ mode: "auto" }, frenchTrack)).toEqual(frenchTrack);
  });

  it("takes the creator's first and next durations in custom mode", () => {
    expect(mercatoRounds({ mode: "custom", firstHours: 48, nextHours: 12 }, frenchTrack)).toEqual({
      firstHours: 48,
      longRounds: 1,
      nextHours: 12,
    });
  });

  it.each([12, 24, 48, 72])("offers rounds of %i hours", (h) => {
    expect(isRoundHours(h)).toBe(true);
  });

  it.each([0, 6, 36, 96])("refuses rounds of %i hours", (h) => {
    expect(isRoundHours(h)).toBe(false);
  });
});
