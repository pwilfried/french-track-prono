import { describe, expect, it } from "vitest";

import type { DisciplineFamily } from "@/domain/discipline";
import { trophyKey, type Trophy, type TrophyMoment } from "@/domain/trophies";

import { UseCaseError } from "./errors";
import type { RankingLine, RankingRepository } from "./rankings";
import {
  awardDueTrophies,
  awardSeasonTrophies,
  getTrophyShowcase,
  setTrophyWitness,
  type SeasonFacts,
  type TrophyRepository,
} from "./trophies";

/** Score lines by competition slug. */
const createInMemoryRankingRepository = (
  byCompetition: Record<string, RankingLine[]>,
): RankingRepository => ({
  async competitionLines(slug) {
    return (byCompetition[slug] ?? []).map((l) => ({ ...l }));
  },
});

/**
 * A fake of the trophy port: the facts of each season, admins only for drawing; an announcement
 * (moment or news) made twice is kept once, as in the database.
 */
function createInMemoryTrophyStore(fixture: {
  players: Record<string, string>;
  admins: string[];
  facts: Record<number, Omit<SeasonFacts, "witnessId">>;
  trophies?: Trophy[];
}) {
  let trophies: Trophy[] = [...(fixture.trophies ?? [])];
  let witnessId: string | null = null;
  const moments = new Map<string, TrophyMoment>();
  const news = new Map<string, Trophy>();
  return {
    all: () => trophies,
    moments: () => [...moments.values()],
    news: () => [...news.values()],
    session(userId: string): TrophyRepository {
      const admin = () => {
        if (!fixture.admins.includes(userId)) throw new UseCaseError("NOT_ADMIN");
      };
      return {
        async seasonFacts(season) {
          admin();
          const none = { competitions: [], leagues: [], manager: [] };
          return { ...(fixture.facts[season] ?? none), witnessId };
        },
        async seasonTrophies(season) {
          admin();
          return trophies.filter((t) => t.season === season);
        },
        async replaceSeason(season, next, announcements) {
          admin();
          trophies = [...trophies.filter((t) => t.season !== season), ...next];
          for (const m of announcements.moments) {
            const key = `${m.feed}|${m.leagueId}|${m.key}`;
            if (!moments.has(key)) moments.set(key, m);
          }
          for (const t of announcements.news) {
            const key = `${trophyKey(t)}|${t.metal ?? ""}`;
            if (!news.has(key)) news.set(key, t);
          }
        },
        async ofPlayer(playerId) {
          return trophies.filter((t) => t.userId === playerId);
        },
        async witness() {
          return witnessId ? fixture.players[witnessId]! : null;
        },
        async setWitness(pseudo) {
          admin();
          if (!pseudo) {
            witnessId = null;
            return "cleared";
          }
          const found = Object.keys(fixture.players).find(
            (id) => fixture.players[id]!.toLowerCase() === pseudo.toLowerCase(),
          );
          if (!found) return "unknown";
          witnessId = found;
          return "saved";
        },
      };
    },
  };
}

const line = (
  userId: string,
  points: number,
  day: string,
  family: DisciplineFamily = "throws",
): RankingLine => ({
  userId,
  pseudo: userId,
  bib: { number: 1, color: "blue" },
  points,
  reasons: [],
  eventId: `${day}-${userId}-${points}`,
  eventStartsAt: `${day}T18:00:00.000Z`,
  eventLockAt: `${day}T17:00:00.000Z`,
  eventFamily: family,
});

const players = {
  adm: "Arbitre",
  ana: "Ana",
  bob: "Bob",
  cyd: "Cyd",
  dan: "Dan",
  ft: "FrenchTrack",
};
const joined = "2026-01-01T00:00:00.000Z";
const member = (userId: string, joinedAt = joined) => ({ userId, joinedAt });

/**
 * The 2026 season: « Les lanceurs » plays « Meeting de juin » (over) with ana, bob, cyd and dan;
 * « Ligue d'automne » plays « Meeting de décembre » too, not over on 2026-11-14. The FrenchTrack
 * account `ft` played in June. Mercato, a Manager league, ended in September.
 */
function world(trophies: Trophy[] = []) {
  const june = { slug: "meeting-juin", endsOn: "2026-06-14" };
  const december = { slug: "meeting-decembre", endsOn: "2026-12-12" };
  const facts: Omit<SeasonFacts, "witnessId"> = {
    competitions: [june, december],
    leagues: [
      {
        id: "L",
        name: "Les lanceurs",
        members: ["ana", "bob", "cyd", "dan"].map((id) => member(id)),
        competitions: [{ ...june, addedAt: null }],
        families: [],
      },
      {
        id: "A",
        name: "Ligue d'automne",
        members: ["ana", "bob", "cyd", "dan"].map((id) => member(id)),
        competitions: [
          { ...june, addedAt: null },
          { ...december, addedAt: null },
        ],
        families: [],
      },
    ],
    manager: [
      {
        leagueId: "M",
        leagueName: "Mercato",
        endedAt: "2026-09-20T10:00:00.000Z",
        standings: [
          { userId: "bob", rank: 1 },
          { userId: "ana", rank: 2 },
        ],
      },
    ],
  };
  const store = createInMemoryTrophyStore({
    players,
    admins: ["adm"],
    facts: { 2026: facts },
    trophies,
  });
  const ranking = createInMemoryRankingRepository({
    "meeting-juin": [
      line("ana", 20, "2026-06-13"),
      line("ana", 12, "2026-06-14"),
      line("bob", 25, "2026-06-14"),
      line("cyd", 10, "2026-06-13"),
      line("dan", 2, "2026-06-13"),
      line("ft", 15, "2026-06-13"),
    ],
  });
  const ports = (today: string) => ({
    trophies: store.session("adm"),
    ranking,
    today: () => today,
  });
  const award = (today: string) => awardSeasonTrophies(ports(today)).execute({ season: 2026 });
  const daily = (today: string) => awardDueTrophies(ports(today)).execute();
  return { store, award, daily };
}

const summary = (
  trophies: { userId: string; kind: string; metal: string | null; leagueId: string | null }[],
) => trophies.map((t) => [t.userId, t.kind, t.metal ?? "-", t.leagueId ?? "-"].join(" ")).sort();

describe("awardSeasonTrophies", () => {
  it("awards the podium and the feats of a finished league and the Manager podium", async () => {
    // Given the June meeting is over, December still to come
    const { store, award } = world();

    // When the admin draws the 2026 trophies on 14 Nov.
    await award("2026-11-14");

    // Then « Les lanceurs » has its podium (the bear: throws) and its Chrono figé,
    // « Ligue d'automne » nothing yet, the general ranking nothing before the year is over
    expect(summary(store.all())).toEqual([
      "ana league gold L",
      "ana manager silver M",
      "bob chrono - L",
      "bob league silver L",
      "bob manager gold M",
      "cyd league bronze L",
    ]);
    expect(store.all().find((t) => t.kind === "league")?.animal).toBe("ours");
  });

  it("gives the Témoin d'or to the players ahead of the FrenchTrack account once it is set", async () => {
    const { store, award } = world();
    await award("2026-11-14");
    expect(store.all().some((t) => t.kind === "witness")).toBe(false);

    await setTrophyWitness({ trophies: store.session("adm") }).execute({ pseudo: "frenchtrack" });
    await award("2026-11-14");

    expect(summary(store.all().filter((t) => t.kind === "witness"))).toEqual([
      "ana witness - -",
      "bob witness - -",
    ]);
  });

  it("awards the laurels of the general ranking once the year is over, without duplicates", async () => {
    const { store, award } = world();

    await award("2027-01-02");
    await award("2027-01-02");

    const general = summary(store.all().filter((t) => t.kind === "general"));
    expect(general).toEqual([
      "ana general gold -",
      "bob general silver -",
      "cyd general bronze -",
      "dan general bronze -",
      "ft general silver -",
    ]);
    // « Ligue d'automne » is over too: its podium is counted once.
    expect(store.all().filter((t) => t.kind === "league" && t.leagueId === "A")).toHaveLength(3);
    expect(store.all().filter((t) => t.kind === "league" && t.userId === "bob")).toHaveLength(2);
  });

  it("counts only the predictions a member made after joining the league", async () => {
    const late = createInMemoryTrophyStore({
      players,
      admins: ["adm"],
      facts: {
        2026: {
          competitions: [{ slug: "meeting-juin", endsOn: "2026-06-14" }],
          leagues: [
            {
              id: "L",
              name: "Les lanceurs",
              members: [
                member("ana", "2026-06-14T00:00:00.000Z"),
                member("bob"),
                member("cyd"),
                member("dan"),
              ],
              competitions: [{ slug: "meeting-juin", endsOn: "2026-06-14", addedAt: null }],
              families: [],
            },
          ],
          manager: [],
        },
      },
    });
    await awardSeasonTrophies({
      trophies: late.session("adm"),
      ranking: createInMemoryRankingRepository({
        "meeting-juin": [
          line("ana", 20, "2026-06-13"),
          line("ana", 12, "2026-06-14"),
          line("bob", 25, "2026-06-14"),
          line("cyd", 10, "2026-06-13"),
          line("dan", 2, "2026-06-13"),
        ],
      }),
      today: () => "2026-11-14",
    }).execute({ season: 2026 });

    // ana's 20 points of the 13th came before she joined: 12 only, behind bob.
    expect(summary(late.all().filter((t) => t.kind === "league"))).toEqual([
      "ana league silver L",
      "bob league gold L",
      "cyd league bronze L",
    ]);
  });

  it("counts the jokers played in the league: a double puts a member on the top step", async () => {
    // Given the June meeting: without a joker ana has 32 points, bob 25
    const league = (jokerPlays: SeasonFacts["leagues"][number]["jokerPlays"]) =>
      createInMemoryTrophyStore({
        players,
        admins: ["adm"],
        facts: {
          2026: {
            competitions: [{ slug: "meeting-juin", endsOn: "2026-06-14" }],
            leagues: [
              {
                id: "L",
                name: "Les lanceurs",
                members: ["ana", "bob", "cyd", "dan"].map((id) => member(id)),
                competitions: [{ slug: "meeting-juin", endsOn: "2026-06-14", addedAt: null }],
                families: [],
                jokerPlays,
              },
            ],
            manager: [],
          },
        },
      });
    const bobLine = { ...line("bob", 25, "2026-06-14"), jokers: { double: 50 } };
    const draw = async (store: ReturnType<typeof league>) => {
      await awardSeasonTrophies({
        trophies: store.session("adm"),
        ranking: createInMemoryRankingRepository({
          "meeting-juin": [
            line("ana", 20, "2026-06-13"),
            line("ana", 12, "2026-06-14"),
            bobLine as RankingLine,
            line("cyd", 10, "2026-06-13"),
            line("dan", 2, "2026-06-13"),
          ],
        }),
        today: () => "2026-11-14",
      }).execute({ season: 2026 });
      return summary(store.all().filter((t) => t.kind === "league"));
    };

    // When bob played his double on his 25 points, then when no joker was played
    const withJoker = await draw(
      league([{ userId: "bob", eventId: bobLine.eventId, joker: "double" }]),
    );
    const without = await draw(league(undefined));

    // Then bob wins the league only with the joker
    expect(withJoker).toEqual(["ana league silver L", "bob league gold L", "cyd league bronze L"]);
    expect(without).toEqual(["ana league gold L", "bob league silver L", "cyd league bronze L"]);
  });

  it("refuses a player who is not an admin", async () => {
    const { store } = world();
    await expect(
      awardSeasonTrophies({
        trophies: store.session("ana"),
        ranking: createInMemoryRankingRepository({}),
        today: () => "2026-11-14",
      }).execute({ season: 2026 }),
    ).rejects.toMatchObject({ code: "NOT_ADMIN" });
  });
});

describe("announcing the fresh trophies (#1134)", () => {
  const won = (over: Partial<Trophy>): Trophy => ({
    userId: "ana",
    season: 2026,
    kind: "league",
    metal: "gold",
    leagueId: "L",
    leagueName: "Les lanceurs",
    animal: "ours",
    ...over,
  });

  it("announces only the new trophies: not one already there, not one taken back", async () => {
    // Given ana already holds the gold of « Les lanceurs », and dan a Chrono figé he loses
    const { store, award } = world([
      won({}),
      won({ userId: "dan", kind: "chrono", metal: null, animal: null }),
    ]);

    // When the 2026 trophies are drawn on 14 Nov.
    const { fresh } = await award("2026-11-14");

    // Then the new ones are notified, not ana's gold, not dan's lost Chrono figé
    expect(summary(fresh)).toEqual([
      "ana manager silver M",
      "bob chrono - L",
      "bob league silver L",
      "bob manager gold M",
      "cyd league bronze L",
    ]);
    expect(summary(store.news())).toEqual(summary(fresh));
    expect(store.all().some((t) => t.userId === "dan")).toBe(false);
  });

  it("tells the whole podium in one moment of the league, the feats one by one", async () => {
    // Given the June meeting is over
    const { store, award } = world();

    // When the trophies are drawn
    await award("2026-11-14");

    // Then « Les lanceurs » gets one podium moment and the Chrono figé, Mercato its podium
    expect(store.moments().map((m) => `${m.feed} ${m.leagueId} ${m.key}`)).toEqual([
      "league L trophy:2026:league:L",
      "league L trophy:2026:chrono:L:bob",
      "manager M trophy:2026:manager:M",
    ]);
    expect(store.moments()[0]!.podium).toEqual([
      { userId: "ana", metal: "gold" },
      { userId: "bob", metal: "silver" },
      { userId: "cyd", metal: "bronze" },
    ]);
    expect(store.moments()[1]!.points).toBe(25);
  });

  it("gives the general ranking and the Témoin d'or a notification but no moment", async () => {
    const { store, award } = world();
    await setTrophyWitness({ trophies: store.session("adm") }).execute({ pseudo: "frenchtrack" });

    await award("2027-01-02");

    const kinds = (list: { kind?: string; trophy?: string }[]) =>
      new Set(list.map((t) => t.kind ?? t.trophy));
    expect(kinds(store.news())).toContain("general");
    expect(kinds(store.news())).toContain("witness");
    expect(kinds(store.moments())).not.toContain("general");
    expect(kinds(store.moments())).not.toContain("witness");
  });
});

describe("awardDueTrophies (#1134)", () => {
  it("draws the current season every day, and the one just over in January", async () => {
    const { store, daily } = world();

    expect((await daily("2026-11-14")).map((d) => d.season)).toEqual([2026]);
    expect(store.all().some((t) => t.kind === "general")).toBe(false);

    expect((await daily("2027-01-02")).map((d) => d.season)).toEqual([2026, 2027]);
    expect(store.all().some((t) => t.kind === "general" && t.season === 2026)).toBe(true);
  });

  it("run twice, adds no trophy and announces nothing again", async () => {
    // Given the daily draw ran once
    const { store, daily } = world();
    await daily("2026-11-14");
    const trophies = summary(store.all());
    const announced = { moments: store.moments().length, news: store.news().length };

    // When it runs again
    const again = await daily("2026-11-14");

    // Then nothing is new
    expect(again).toEqual([{ season: 2026, awarded: trophies.length, fresh: 0 }]);
    expect(summary(store.all())).toEqual(trophies);
    expect({ moments: store.moments().length, news: store.news().length }).toEqual(announced);
  });
});

describe("getTrophyShowcase", () => {
  it("shows a player one shelf per season, the latest first", async () => {
    const { store, award } = world();
    await award("2026-11-14");

    const shelves = await getTrophyShowcase({ trophies: store.session("bob") }).execute({
      userId: "bob",
    });

    expect(shelves).toHaveLength(1);
    expect(shelves[0]!.season).toBe(2026);
    expect(shelves[0]!.trophies.map((t) => t.kind)).toEqual(["league", "manager", "chrono"]);
  });
});

describe("setTrophyWitness", () => {
  it("refuses an unknown or overlong pseudo", async () => {
    const { store } = world();
    const set = setTrophyWitness({ trophies: store.session("adm") });
    await expect(set.execute({ pseudo: "Personne" })).rejects.toMatchObject({
      code: "TROPHY_WITNESS_UNKNOWN",
    });
    await expect(set.execute({ pseudo: "x".repeat(25) })).rejects.toMatchObject({
      code: "TROPHY_WITNESS_UNKNOWN",
    });
    expect(await set.execute({ pseudo: "  " })).toBe("cleared");
  });
});
