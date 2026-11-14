import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  BADGES,
  FAMILY_BADGES,
  GAME_BADGES,
  badgeCounts,
  badgeProgress,
  isEarned,
  levelOf,
  nextBadge,
  nextLevel,
  progressOf,
  raisedBadges,
  type BadgeInput,
  type BadgeProgress,
} from "./badges";
import type { DisciplineFamily } from "./discipline";

const at = (day: number) => `2026-11-2${day}T19:00:00Z`;
const base: BadgeInput = {
  myLines: [],
  computedEvents: [],
  frenchWinnerEvents: new Set(),
  days: [],
  predictedEventIds: new Set(),
};
const line = (
  eventId: string,
  points: number,
  reasons: BadgeInput["myLines"][number]["reasons"] = [],
  family: DisciplineFamily | null = null,
  day = 3,
) => ({ eventId, eventStartsAt: at(day), points, reasons, family });
const winner = (eventId: string) => line(eventId, 3, [{ kind: "exact", slot: 1 }]);
const many = <T>(n: number, make: (i: number) => T) => Array.from({ length: n }, (_, i) => make(i));

// The level of each badge, keyed by badge.
const levels = (input: BadgeInput, stored = {}) =>
  Object.fromEntries(badgeProgress(input, stored).map((p) => [p.badge, p.level]));

describe("badge list", () => {
  it("has 6 game badges, then one badge per family, in display order", () => {
    expect(GAME_BADGES).toEqual(["nostradamus", "chasseur", "flair", "serie", "bleus", "fidele"]);
    expect(FAMILY_BADGES).toEqual(["foudre", "haies", "train", "bond", "envol", "force", "touche"]);
    expect(badgeProgress(base).map((p) => p.badge)).toEqual(BADGES);
  });

  it("gives nothing to a new player, each badge aiming at its bronze threshold", () => {
    const progress = badgeProgress(base);
    expect(progress.every((p) => p.level === null && p.current === 0)).toBe(true);
    expect(Object.fromEntries(progress.map((p) => [p.badge, p.target]))).toEqual({
      nostradamus: 1,
      chasseur: 3,
      flair: 1,
      serie: 5,
      bleus: 1,
      fidele: 1,
      foudre: 50,
      haies: 50,
      train: 50,
      bond: 50,
      envol: 50,
      force: 50,
      touche: 50,
    });
  });
});

describe("levelOf", () => {
  it.each([
    ["nostradamus", 0, null],
    ["nostradamus", 1, "bronze"],
    ["nostradamus", 2, "bronze"],
    ["nostradamus", 3, "silver"],
    ["nostradamus", 9, "silver"],
    ["nostradamus", 10, "gold"],
    ["chasseur", 2, null],
    ["chasseur", 3, "bronze"],
    ["chasseur", 9, "bronze"],
    ["chasseur", 10, "silver"],
    ["chasseur", 29, "silver"],
    ["chasseur", 30, "gold"],
    ["flair", 3, "silver"],
    ["flair", 10, "gold"],
    ["serie", 4, null],
    ["serie", 5, "bronze"],
    ["serie", 10, "silver"],
    ["serie", 19, "silver"],
    ["serie", 20, "gold"],
    ["bleus", 1, "bronze"],
    ["bleus", 4, "bronze"],
    ["bleus", 5, "silver"],
    ["bleus", 15, "gold"],
    ["fidele", 1, "bronze"],
    ["fidele", 5, "silver"],
    ["fidele", 14, "silver"],
    ["fidele", 15, "gold"],
    ["foudre", 49, null],
    ["foudre", 50, "bronze"],
    ["foudre", 149, "bronze"],
    ["foudre", 150, "silver"],
    ["foudre", 399, "silver"],
    ["foudre", 400, "gold"],
    ["touche", 1000, "gold"],
  ] as const)("puts %s at %i on %s", (badge, count, level) => {
    expect(levelOf(badge, count)).toBe(level);
  });
});

describe("nextLevel", () => {
  it("goes from nothing to bronze, silver, gold, then nowhere", () => {
    expect([null, "bronze", "silver", "gold"].map((l) => nextLevel(l as never))).toEqual([
      "bronze",
      "silver",
      "gold",
      null,
    ]);
  });
});

describe("badgeCounts", () => {
  it("counts perfect podiums, winners found and coups de flair", () => {
    const counts = badgeCounts({
      ...base,
      myLines: [
        line("e1", 12, [{ kind: "perfect_podium" }]),
        line("e2", 5, [{ kind: "flair" }]),
        winner("e3"),
        winner("e4"),
      ],
    });
    expect([counts.nostradamus, counts.flair, counts.chasseur]).toEqual([1, 1, 2]);
  });

  it("keeps the best run of computed events with points for Série", () => {
    const ids = ["e1", "e2", "e3", "e4", "e5", "e6", "e7"];
    const computedEvents = ids.map((eventId, i) => ({ eventId, startsAt: at(i) }));
    // 3 in a row, a miss, then 2: the best run stays 3.
    const myLines = ["e1", "e2", "e3", "e5", "e6"].map((id) => line(id, 1));
    expect(badgeCounts({ ...base, computedEvents, myLines }).serie).toBe(3);
  });

  it("counts French winners found and fully predicted days", () => {
    const counts = badgeCounts({
      ...base,
      frenchWinnerEvents: new Set(["e1", "e2"]),
      days: [["a", "b"], ["c"], ["d"], []],
      predictedEventIds: new Set(["a", "b", "c"]),
    });
    expect([counts.bleus, counts.fidele]).toEqual([2, 2]);
  });

  it("adds up the points of each family, both distances on Train d'enfer, relays nowhere", () => {
    const counts = badgeCounts({
      ...base,
      myLines: [
        line("s1", 12, [], "sprint"),
        line("s2", 8, [], "sprint"),
        line("m1", 5, [], "middle"),
        line("l1", 7, [], "long"),
        line("h", 3, [], "horizontal_jumps"),
        line("v", 4, [], "vertical_jumps"),
        line("r", 20, [], "relay"),
        line("bonus", 9, [], null),
      ],
    });
    expect([counts.foudre, counts.train, counts.bond, counts.envol, counts.haies]).toEqual([
      20, 12, 3, 4, 0,
    ]);
  });
});

describe("badgeProgress", () => {
  it("aims at the next level once a badge is earned, and stays at gold once there", () => {
    const progress = badgeProgress({ ...base, myLines: many(12, (i) => winner(`e${i}`)) });
    expect(progress.find((p) => p.badge === "chasseur")).toEqual({
      badge: "chasseur",
      level: "silver",
      current: 12,
      target: 30,
    });
    const gold = badgeProgress({ ...base, frenchWinnerEvents: new Set(many(20, (i) => `e${i}`)) });
    expect(gold.find((p) => p.badge === "bleus")).toEqual({
      badge: "bleus",
      level: "gold",
      current: 20,
      target: 15,
    });
  });

  it("makes a badge earned under the old rules bronze", () => {
    // The old rules: one perfect podium, 3 winners, one flair, 5 in a row, one French winner,
    // one full day. Each is exactly the bronze threshold now.
    const ids = ["e1", "e2", "e3", "e4", "e5"];
    const input: BadgeInput = {
      myLines: [
        line("e1", 12, [{ kind: "perfect_podium" }, { kind: "exact", slot: 1 }], null, 0),
        line("e2", 5, [{ kind: "flair" }, { kind: "exact", slot: 1 }], null, 1),
        line("e3", 3, [{ kind: "exact", slot: 1 }], null, 2),
        line("e4", 1, [], null, 3),
        line("e5", 1, [], null, 4),
      ],
      computedEvents: ids.map((eventId, i) => ({ eventId, startsAt: at(i) })),
      frenchWinnerEvents: new Set(["e1"]),
      days: [["e1"]],
      predictedEventIds: new Set(["e1"]),
    };
    expect(GAME_BADGES.map((b) => levels(input)[b])).toEqual(GAME_BADGES.map(() => "bronze"));
  });

  it("never loses a level already won, even when the season counts start again", () => {
    const progress = badgeProgress(base, { chasseur: "silver", foudre: "gold" });
    expect(progress.find((p) => p.badge === "chasseur")).toMatchObject({
      level: "silver",
      current: 0,
      target: 30,
    });
    expect(progress.find((p) => p.badge === "foudre")?.level).toBe("gold");
    expect(isEarned(progress.find((p) => p.badge === "chasseur")!)).toBe(true);
  });

  it("never gives a lower level than the one counted or the one stored", () => {
    const level = fc.constantFrom(null, "bronze", "silver", "gold");
    const rank = (l: string | null) => (l ? ["bronze", "silver", "gold"].indexOf(l) : -1);
    fc.assert(
      fc.property(fc.nat({ max: 50 }), level, (perfect, stored) => {
        const input = {
          ...base,
          myLines: many(perfect, (i) => line(`e${i}`, 12, [{ kind: "perfect_podium" as const }])),
        };
        const got = badgeProgress(input, stored ? { nostradamus: stored } : {}).find(
          (p) => p.badge === "nostradamus",
        )!.level;
        expect(rank(got)).toBe(Math.max(rank(levelOf("nostradamus", perfect)), rank(stored)));
      }),
    );
  });
});

describe("raisedBadges", () => {
  it("lists the badges whose level went up since the last one shown", () => {
    const progress: BadgeProgress[] = [
      { badge: "nostradamus", level: "bronze", current: 1, target: 3 },
      { badge: "chasseur", level: "silver", current: 10, target: 30 },
      { badge: "flair", level: "gold", current: 10, target: 10 },
      { badge: "serie", level: null, current: 2, target: 5 },
    ];
    expect(raisedBadges(progress, { chasseur: "bronze", flair: "gold" })).toEqual([
      { badge: "nostradamus", level: "bronze" },
      { badge: "chasseur", level: "silver" },
    ]);
  });
});

describe("nextBadge", () => {
  it("picks the badge with the smallest share of its next threshold left", () => {
    // Chasseur: 1 of 3 left (a third); Foudre: 10 of 50 left (a fifth); Nostradamus: all left.
    expect(
      nextBadge([
        { badge: "nostradamus", level: null, current: 0, target: 1 },
        { badge: "chasseur", level: null, current: 2, target: 3 },
        { badge: "foudre", level: null, current: 40, target: 50 },
      ]),
    ).toEqual({
      badge: "foudre",
      level: null,
      current: 40,
      target: 50,
      left: 10,
      next: "bronze",
    });
  });

  it("aims at the next level of an earned badge", () => {
    expect(
      nextBadge([
        { badge: "nostradamus", level: "bronze", current: 1, target: 3 },
        { badge: "flair", level: null, current: 0, target: 1 },
      ]),
    ).toEqual({
      badge: "nostradamus",
      level: "bronze",
      current: 1,
      target: 3,
      left: 2,
      next: "silver",
    });
  });

  it("offers a new player the easiest badge, not a perfect podium (#768)", () => {
    const fresh = BADGES.map((badge) => progressOf(badge, 0));
    expect(nextBadge(fresh)?.badge).toBe("fidele");
  });

  it("returns null once every badge is gold", () => {
    expect(nextBadge([{ badge: "flair", level: "gold", current: 10, target: 10 }])).toBeNull();
  });
});
