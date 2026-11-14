import { describe, expect, it } from "vitest";

import type { DisciplineFamily } from "@/domain/discipline";
import type { Trophy } from "@/domain/trophies";

import { UseCaseError } from "./errors";
import type { RankingLine, RankingRepository } from "./rankings";
import {
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

/** A fake of the trophy port: the facts of each season, admins only for drawing. */
function createInMemoryTrophyStore(fixture: {
  players: Record<string, string>;
  admins: string[];
  facts: Record<number, Omit<SeasonFacts, "witnessId">>;
}) {
  let trophies: Trophy[] = [];
  let witnessId: string | null = null;
  return {
    all: () => trophies,
    session(userId: string): TrophyRepository {
      const admin = () => {
        if (!fixture.admins.includes(userId)) throw new UseCaseError("NOT_ADMIN");
      };
      return {
        async seasonFacts(season) {
          admin();
          return { ...fixture.facts[season]!, witnessId };
        },
        async replaceSeason(season, next) {
          admin();
          trophies = [...trophies.filter((t) => t.season !== season), ...next];
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
function world() {
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
  const award = (today: string) =>
    awardSeasonTrophies({
      trophies: store.session("adm"),
      ranking,
      today: () => today,
    }).execute({ season: 2026 });
  return { store, award };
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
    expect(store.all().find((t) => t.kind === "league")?.animal).toBe("bear");
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
