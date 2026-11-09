import { describe, expect, it } from "vitest";

import { seasonCardOf } from "./season-card";

const season = {
  points: 42,
  rank: 3,
  players: 120,
  bestShot: { discipline: "100 m", gender: "F" as const, points: 12, perfect: true },
};

describe("seasonCardOf", () => {
  it("keeps the public figures of the season", () => {
    expect(
      seasonCardOf({
        profile: { pseudo: "Démo Gazelle", avatar: "🦌" },
        club: { name: "Démo Club", validated: true },
        season,
      }),
    ).toEqual({
      pseudo: "Démo Gazelle",
      avatar: "🦌",
      club: "Démo Club",
      points: 42,
      rank: 3,
      players: 120,
      best: { discipline: "100 m", gender: "F", points: 12, perfect: true },
    });
  });

  it("never carries private data, even when it is passed along", () => {
    const card = seasonCardOf({
      profile: { pseudo: "Démo", avatar: "🦌", email: "demo@example.test" } as never,
      club: { name: "Club à valider", validated: false, city: "Testville" } as never,
      season: {
        ...season,
        sex: "F",
        disciplines: ["sprint"],
        bestShot: { ...season.bestShot, eventId: "secret", reasons: [] },
      } as never,
    });
    const text = JSON.stringify(card);
    for (const secret of [
      "example.test",
      "sprint",
      "sex",
      "Club à valider",
      "Testville",
      "secret",
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(card.club).toBeNull();
  });

  it("has no best shot before the first computed event", () => {
    const card = seasonCardOf({
      profile: { pseudo: "Démo", avatar: "🦌" },
      club: null,
      season: { points: 0, rank: null, players: 10, bestShot: null },
    });
    expect(card.best).toBeNull();
    expect(card.rank).toBeNull();
  });
});
