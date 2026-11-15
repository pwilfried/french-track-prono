import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { DisciplineFamily } from "./discipline";
import {
  competitionOver,
  generalMetal,
  generalTrophies,
  leagueOver,
  leagueSeason,
  leagueTrophies,
  managerTrophies,
  mostPlayedAnimal,
  podiumMetal,
  seasonOver,
  trophyKey,
  trophyShelves,
  witnessTrophies,
  type FinishedLeague,
  type Trophy,
  type TrophyLine,
} from "./trophies";

// 18:00 UTC: 19:00 or 20:00 in Paris, the evening of that day.
const line = (
  userId: string,
  points: number,
  day = "2026-07-10",
  competitionSlug = "meeting-a",
  eventFamily: DisciplineFamily = "sprint",
): TrophyLine => ({
  userId,
  points,
  reasons: [],
  eventStartsAt: `${day}T18:00:00.000Z`,
  eventFamily,
  competitionSlug,
});

const league = (lines: TrophyLine[], over: Partial<FinishedLeague> = {}): FinishedLeague => ({
  id: "L",
  name: "Les copains",
  season: 2026,
  memberIds: ["ana", "bob", "cyd", "dan"],
  lines,
  competitions: [{ slug: "meeting-a", endsOn: "2026-07-12" }],
  ...over,
});

const of = (trophies: Trophy[], kind: Trophy["kind"]) =>
  trophies
    .filter((t) => t.kind === kind)
    .map((t) => (t.metal ? `${t.userId}:${t.metal}` : t.userId))
    .sort();

describe("metals", () => {
  it("gives gold, silver and bronze to the podium of a league only", () => {
    expect([1, 2, 3, 4].map(podiumMetal)).toEqual(["gold", "silver", "bronze", null]);
  });

  it("gives the laurel in gold to the 1st, silver to the 2nd and 3rd, bronze down to the 10th", () => {
    expect([1, 2, 3, 4, 10, 11].map(generalMetal)).toEqual([
      "gold",
      "silver",
      "silver",
      "bronze",
      "bronze",
      null,
    ]);
  });
});

describe("animals", () => {
  it("picks the animal of the family most played, adding up the two families of the hare", () => {
    const lines = [
      line("ana", 1, undefined, undefined, "sprint"),
      line("ana", 1, undefined, undefined, "sprint"),
      line("bob", 1, undefined, undefined, "middle"),
      line("bob", 1, undefined, undefined, "long"),
      line("cyd", 1, undefined, undefined, "long"),
    ];
    expect(mostPlayedAnimal(lines)).toBe("lievre");
  });

  it("breaks a tie by the order of the animals and falls back on the hare without lines", () => {
    expect(
      mostPlayedAnimal([
        line("a", 1, undefined, undefined, "throws"),
        line("a", 1, undefined, undefined, "hurdles"),
      ]),
    ).toBe("impala");
    expect(mostPlayedAnimal([])).toBe("lievre");
  });
});

describe("when a trophy is final", () => {
  it("ends a competition the day after its last day", () => {
    const c = { slug: "c", endsOn: "2026-07-12" };
    expect(competitionOver(c, "2026-07-12")).toBe(false);
    expect(competitionOver(c, "2026-07-13")).toBe(true);
  });

  it("ends a league once each of its competitions is over, in the year of the last one", () => {
    const competitions = [
      { slug: "a", endsOn: "2026-07-12" },
      { slug: "b", endsOn: "2027-01-05" },
    ];
    expect(leagueOver(competitions, "2026-12-01")).toBe(false);
    expect(leagueOver(competitions, "2027-01-06")).toBe(true);
    expect(leagueOver([], "2027-01-06")).toBe(false);
    expect(leagueSeason(competitions)).toBe(2027);
  });

  it("ends the general ranking of a season once its year is over", () => {
    expect(seasonOver(2026, "2026-12-31")).toBe(false);
    expect(seasonOver(2026, "2027-01-01")).toBe(true);
  });
});

describe("leagueTrophies — podium", () => {
  it("gives the top 3 of a league of 4 players the statuette of its most played family", () => {
    const trophies = leagueTrophies(
      league([line("ana", 30), line("bob", 20), line("cyd", 10), line("dan", 5)]),
    );
    expect(of(trophies, "league")).toEqual(["ana:gold", "bob:silver", "cyd:bronze"]);
    expect(trophies.find((t) => t.kind === "league")).toMatchObject({
      season: 2026,
      leagueId: "L",
      leagueName: "Les copains",
      animal: "guepard",
    });
  });

  it("gives no podium in a league of fewer than 4 players", () => {
    const trophies = leagueTrophies(
      league([line("ana", 30), line("bob", 20), line("cyd", 10)], {
        memberIds: ["ana", "bob", "cyd"],
      }),
    );
    expect(of(trophies, "league")).toEqual([]);
  });

  it("counts a member without any point among the 4 players, but gives them nothing", () => {
    const trophies = leagueTrophies(league([line("ana", 30), line("bob", 20), line("cyd", 10)]));
    expect(of(trophies, "league")).toEqual(["ana:gold", "bob:silver", "cyd:bronze"]);
    const noPoints = leagueTrophies(league([line("ana", 30), line("bob", 20)]));
    expect(of(noPoints, "league")).toEqual(["ana:gold", "bob:silver"]);
  });

  it("shares the metal between players still tied and skips the rank after them", () => {
    const trophies = leagueTrophies(
      league([line("ana", 30), line("bob", 20), line("cyd", 20), line("dan", 10)]),
    );
    expect(of(trophies, "league")).toEqual(["ana:gold", "bob:silver", "cyd:silver"]);
  });

  it("breaks a tie on points with the perfect podiums, as the league ranking does", () => {
    const perfect = { ...line("cyd", 20), reasons: [{ kind: "perfect_podium" as const }] };
    const trophies = leagueTrophies(
      league([line("ana", 30), line("bob", 20), perfect, line("dan", 10)]),
    );
    expect(of(trophies, "league")).toEqual(["ana:gold", "bob:bronze", "cyd:silver"]);
  });
});

describe("leagueTrophies — Chrono figé", () => {
  it("goes to the most points won in one competition day of the league", () => {
    const trophies = leagueTrophies(
      league([
        line("ana", 10, "2026-07-10"),
        line("ana", 10, "2026-07-11"),
        line("bob", 15, "2026-07-11"),
        line("cyd", 4, "2026-07-10"),
      ]),
    );
    expect(of(trophies, "chrono")).toEqual(["bob"]);
  });

  it("goes to every player tied on the best day, never with 0 points", () => {
    const tied = leagueTrophies(league([line("ana", 12), line("bob", 12), line("cyd", 3)]));
    expect(of(tied, "chrono")).toEqual(["ana", "bob"]);
    expect(of(leagueTrophies(league([line("ana", 0)])), "chrono")).toEqual([]);
  });

  it("adds up the events of one day only, Paris time", () => {
    const late = { ...line("ana", 6), eventStartsAt: "2026-07-10T21:30:00.000Z" };
    const trophies = leagueTrophies(league([line("ana", 6), late, line("bob", 10)]));
    expect(of(trophies, "chrono")).toEqual(["ana"]);
  });
});

describe("leagueTrophies — Record de ligue", () => {
  const competitions = [
    { slug: "meeting-a", endsOn: "2026-06-01" },
    { slug: "meeting-b", endsOn: "2026-07-01" },
    { slug: "meeting-c", endsOn: "2026-08-01" },
  ];

  it("goes to the player who beats the best total of an earlier competition", () => {
    const trophies = leagueTrophies(
      league(
        [
          line("ana", 20, "2026-06-01", "meeting-a"),
          line("bob", 25, "2026-07-01", "meeting-b"),
          line("cyd", 22, "2026-08-01", "meeting-c"),
        ],
        { competitions },
      ),
    );
    expect(of(trophies, "record")).toEqual(["bob"]);
  });

  it("is not won by equalling the record, nor in the first competition", () => {
    const trophies = leagueTrophies(
      league(
        [line("ana", 20, "2026-06-01", "meeting-a"), line("bob", 20, "2026-07-01", "meeting-b")],
        { competitions },
      ),
    );
    expect(of(trophies, "record")).toEqual([]);
  });

  it("can be won by several players, once each per league", () => {
    const trophies = leagueTrophies(
      league(
        [
          line("ana", 10, "2026-06-01", "meeting-a"),
          line("bob", 15, "2026-07-01", "meeting-b"),
          line("cyd", 15, "2026-07-01", "meeting-b"),
          line("bob", 30, "2026-08-01", "meeting-c"),
        ],
        { competitions },
      ),
    );
    expect(of(trophies, "record")).toEqual(["bob", "cyd"]);
  });
});

describe("managerTrophies", () => {
  it("gives the top 3 of the Manager standings the hare, shared on a full tie", () => {
    const trophies = managerTrophies({
      leagueId: "M",
      leagueName: "Mercato",
      endedAt: "2026-09-14T08:00:00.000Z",
      standings: [
        { userId: "ana", rank: 1 },
        { userId: "bob", rank: 1 },
        { userId: "cyd", rank: 3 },
        { userId: "dan", rank: 4 },
      ],
    });
    expect(of(trophies, "manager")).toEqual(["ana:gold", "bob:gold", "cyd:bronze"]);
    expect(trophies[0]).toMatchObject({ season: 2026, animal: "lievre", leagueName: "Mercato" });
  });
});

describe("generalTrophies", () => {
  it("gives the laurels to the top 10 of the season, ties sharing them", () => {
    const lines = Array.from({ length: 12 }, (_, i) => line(`p${i + 1}`, 100 - i));
    lines.push(line("p0", 99)); // tied with p2 on the 2nd place
    const trophies = generalTrophies(2026, lines);
    const metals = Object.fromEntries(trophies.map((t) => [t.userId, t.metal]));
    expect(metals).toMatchObject({ p1: "gold", p0: "silver", p2: "silver", p3: "bronze" });
    expect(metals.p9).toBe("bronze");
    expect(metals.p10).toBeUndefined();
    expect(trophies).toHaveLength(10);
  });

  it("never gives a laurel to a player without any point", () => {
    expect(generalTrophies(2026, [line("ana", 0)])).toEqual([]);
  });
});

describe("witnessTrophies", () => {
  const meeting = (lines: TrophyLine[]) => ({ lines });

  it("goes to the players ahead of the FrenchTrack account in one competition, once a season", () => {
    const trophies = witnessTrophies(2026, "ft", [
      meeting([line("ana", 30), line("ft", 20), line("bob", 10)]),
      meeting([line("ana", 30), line("ft", 20), line("bob", 25)]),
    ]);
    expect(of(trophies, "witness")).toEqual(["ana", "bob"]);
  });

  it("is not won when tied with the account", () => {
    const trophies = witnessTrophies(2026, "ft", [meeting([line("ana", 20), line("ft", 20)])]);
    expect(trophies).toEqual([]);
  });

  it("is not offered without a designated account, nor when it did not play", () => {
    expect(witnessTrophies(2026, null, [meeting([line("ana", 30)])])).toEqual([]);
    expect(witnessTrophies(2026, "ft", [meeting([line("ana", 30)])])).toEqual([]);
  });
});

describe("trophyShelves", () => {
  const trophy = (over: Partial<Trophy>): Trophy => ({
    userId: "ana",
    season: 2026,
    kind: "league",
    metal: "gold",
    leagueId: "L",
    leagueName: "B",
    animal: "guepard",
    ...over,
  });

  it("puts one shelf per season, the latest first, the finest trophies first", () => {
    const shelves = trophyShelves([
      trophy({ season: 2025, kind: "chrono", metal: null }),
      trophy({ metal: "bronze", leagueName: "A" }),
      trophy({ kind: "witness", metal: null, leagueId: null, leagueName: null }),
      trophy({ kind: "general", metal: "silver", leagueId: null, leagueName: null }),
      trophy({ metal: "gold", leagueName: "C" }),
    ]);
    expect(shelves.map((s) => s.season)).toEqual([2026, 2025]);
    expect(shelves[0]!.trophies.map((t) => `${t.kind}:${t.metal}:${t.leagueName}`)).toEqual([
      "general:silver:null",
      "league:gold:C",
      "league:bronze:A",
      "witness:null:null",
    ]);
  });

  it("has no shelf without a trophy", () => {
    expect(trophyShelves([])).toEqual([]);
  });
});

describe("invariants", () => {
  const lines = fc.array(
    fc.record({
      userId: fc.constantFrom("ana", "bob", "cyd", "dan", "eve"),
      points: fc.integer({ min: 0, max: 28 }),
      day: fc.constantFrom("2026-06-01", "2026-07-01", "2026-08-01"),
    }),
    { maxLength: 30 },
  );
  const toLines = (raw: { userId: string; points: number; day: string }[]) =>
    raw.map((r) => line(r.userId, r.points, r.day, `meeting-${r.day}`));
  const competitions = ["2026-06-01", "2026-07-01", "2026-08-01"].map((d) => ({
    slug: `meeting-${d}`,
    endsOn: d,
  }));
  const keys = (t: Trophy[]) => t.map(trophyKey).sort();

  it("does not depend on the order the score lines arrive in", () => {
    fc.assert(
      fc.property(lines, (raw) => {
        const forward = leagueTrophies(league(toLines(raw), { competitions }));
        const backward = leagueTrophies(league(toLines(raw).reverse(), { competitions }));
        expect(keys(backward)).toEqual(keys(forward));
      }),
    );
  });

  it("never gives a player the same trophy twice", () => {
    fc.assert(
      fc.property(lines, (raw) => {
        const all = [
          ...leagueTrophies(league(toLines(raw), { competitions })),
          ...generalTrophies(2026, toLines(raw)),
        ];
        expect(new Set(all.map(trophyKey)).size).toBe(all.length);
      }),
    );
  });
});
