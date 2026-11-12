import { describe, expect, it } from "vitest";

import type { EventSummary } from "./event";
import { firstFinalToPredict, leagueStanding, nextAction, openFinals } from "./home";

const event = (
  id: string,
  lockAt: string,
  round: EventSummary["round"] = "final",
): EventSummary => ({
  id,
  slug: id,
  discipline: "100 m",
  gender: "F",
  startsAt: lockAt,
  lockAt,
  isFeatured: false,
  status: "upcoming",
  round,
});

describe("openFinals", () => {
  const now = new Date("2026-11-23T12:00:00Z");

  it("keeps the finals still open, in start order, marked predicted or not", () => {
    const finals = openFinals(
      [
        event("late", "2026-11-25T19:00:00Z"),
        event("locked", "2026-11-23T11:00:00Z"),
        event("heat", "2026-11-23T18:00:00Z", "series"),
        event("soon", "2026-11-23T20:40:00Z"),
      ],
      new Set(["late"]),
      now,
    );
    expect(finals.map((f) => [f.id, f.predicted])).toEqual([
      ["soon", false],
      ["late", true],
    ]);
  });

  it("is empty once every final is locked", () => {
    expect(openFinals([event("a", "2026-11-23T12:00:00Z")], new Set(), now)).toEqual([]);
  });
});

describe("firstFinalToPredict", () => {
  const now = new Date("2026-11-23T12:00:00Z");

  it("leads a visitor to the first final still open", () => {
    expect(
      firstFinalToPredict(
        [
          event("late", "2026-11-25T19:00:00Z"),
          event("locked", "2026-11-23T11:00:00Z"),
          event("heat", "2026-11-23T18:00:00Z", "series"),
          event("soon", "2026-11-23T20:40:00Z"),
        ],
        now,
      ),
    ).toBe("soon");
  });

  it("is null when no final is open", () => {
    expect(firstFinalToPredict([event("a", "2026-11-23T11:00:00Z")], now)).toBeNull();
  });
});

describe("nextAction", () => {
  const now = new Date("2026-11-23T12:00:00Z");
  const competition = (slug: string, startsOn: string) => ({ slug, startsOn });

  it("asks for the open final the player has not predicted, the closest to its lock first", () => {
    const action = nextAction({
      events: [
        event("late", "2026-11-25T19:00:00Z"),
        event("predicted", "2026-11-23T18:00:00Z"),
        { ...event("soon", "2026-11-23T20:40:00Z"), lockAt: "2026-11-23T19:00:00Z" },
        { ...event("first-start", "2026-11-23T20:00:00Z"), lockAt: "2026-11-23T19:30:00Z" },
      ],
      predicted: new Set(["predicted"]),
      competitions: [competition("next", "2026-12-10")],
      now,
    });
    expect(action).toMatchObject({ kind: "predict", final: { id: "soon" } });
  });

  it("counts the other finals left to predict the same Paris day", () => {
    const action = nextAction({
      events: [
        event("a", "2026-11-23T18:00:00Z"),
        event("b", "2026-11-23T20:40:00Z"),
        // 23:30 UTC is already the 24th in Paris.
        event("c", "2026-11-23T23:30:00Z"),
        event("d", "2026-11-23T19:00:00Z"),
      ],
      predicted: new Set(["d"]),
      competitions: [],
      now,
    });
    expect(action).toMatchObject({ kind: "predict", final: { id: "a" }, sameDay: 1 });
  });

  it("leaves heats and locked finals out", () => {
    const action = nextAction({
      events: [
        event("heat", "2026-11-23T18:00:00Z", "series"),
        event("gone", "2026-11-23T11:00:00Z"),
      ],
      predicted: new Set(),
      competitions: [competition("next", "2026-12-10")],
      now,
    });
    expect(action).toMatchObject({ kind: "competition", competition: { slug: "next" } });
  });

  it("shows the next competition to start once every open final is predicted", () => {
    const action = nextAction({
      events: [event("done", "2026-11-23T18:00:00Z")],
      predicted: new Set(["done"]),
      competitions: [
        competition("under-way", "2026-11-22"),
        competition("later", "2027-01-20"),
        competition("next", "2026-12-10"),
      ],
      now,
    });
    expect(action).toEqual({
      kind: "competition",
      competition: competition("next", "2026-12-10"),
      daysLeft: 17,
    });
  });

  it("is null without any competition to come and nothing to predict", () => {
    expect(
      nextAction({
        events: [],
        predicted: new Set(),
        competitions: [competition("under-way", "2026-11-22")],
        now,
      }),
    ).toBeNull();
  });
});

describe("leagueStanding", () => {
  const row = (userId: string, rank: number, points: number) => ({
    userId,
    pseudo: userId,
    rank,
    points,
  });
  const league = (id: string, rows: ReturnType<typeof row>[]) => ({ id, rows });

  it("picks the league where the player ranks best, with the one ahead and the one behind", () => {
    const standing = leagueStanding(
      [
        league("low", [row("a", 1, 30), row("b", 2, 20), row("me", 3, 10)]),
        league("high", [row("x", 1, 40), row("me", 2, 35), row("y", 3, 30), row("z", 4, 10)]),
      ],
      "me",
    );
    expect(standing).toEqual({
      leagueId: "high",
      rank: 2,
      total: 4,
      gap: 5,
      rows: [row("x", 1, 40), row("me", 2, 35), row("y", 3, 30)],
    });
  });

  it("shows the first two behind a leader, with no gap", () => {
    const standing = leagueStanding(
      [league("l", [row("me", 1, 40), row("a", 2, 30), row("b", 3, 20), row("c", 4, 10)])],
      "me",
    );
    expect(standing).toMatchObject({ rank: 1, gap: null });
    expect(standing?.rows.map((r) => r.userId)).toEqual(["me", "a", "b"]);
  });

  it("shows the last three around the last player", () => {
    const standing = leagueStanding(
      [league("l", [row("a", 1, 40), row("b", 2, 30), row("me", 3, 20)])],
      "me",
    );
    expect(standing?.rows.map((r) => r.userId)).toEqual(["a", "b", "me"]);
  });

  it("prefers the first league on a tie, and is null when the player is in no ranking", () => {
    expect(
      leagueStanding([league("one", [row("me", 1, 0)]), league("two", [row("me", 1, 0)])], "me")
        ?.leagueId,
    ).toBe("one");
    expect(leagueStanding([league("l", [row("a", 1, 3)])], "me")).toBeNull();
  });
});
