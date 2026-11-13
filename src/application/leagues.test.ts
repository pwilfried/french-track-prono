import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  addLeagueCompetition,
  addLeagueFamily,
  createLeague,
  joinPublicLeague,
  listPublicLeagues,
  reportLeague,
  getLeague,
  handOverLeague,
  joinLeague,
  leaveLeague,
  listMyLeagues,
  type League,
  type LeagueRepository,
} from "./leagues";

const league = (id: string, name: string): League => ({
  id,
  name,
  inviteCode: "K7M2QX",
  ownerId: "me",
  memberCount: 1,
  competitionSlugs: ["c"],
  isPublic: false,
});

function repository(overrides: Partial<LeagueRepository> = {}): LeagueRepository & {
  created: string[];
  competitions: string[][];
  publics: boolean[];
  families: (string[] | undefined)[];
} {
  const created: string[] = [];
  const competitions: string[][] = [];
  const publics: boolean[] = [];
  const families: (string[] | undefined)[] = [];
  return {
    created,
    competitions,
    publics,
    families,
    create: async (name, slugs, isPublic, chosen) => {
      created.push(name);
      competitions.push(slugs);
      publics.push(isPublic);
      families.push(chosen);
      return league("new", name);
    },
    join: async () => ({ outcome: "joined", leagueId: "l1" }),
    listMine: async () => [],
    members: async () => null,
    leave: async () => "left",
    handOver: async () => "done",
    addCompetition: async () => "added",
    addFamily: async () => "added",
    listPublic: async () => [],
    joinPublic: async (id) => ({ outcome: "joined", leagueId: id }),
    report: async () => "reported",
    ...overrides,
  };
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "no error";
  } catch (error) {
    return error instanceof UseCaseError ? error.code : String(error);
  }
};

describe("createLeague", () => {
  it("creates a league limited to the families chosen, in the order of the screen (#613)", async () => {
    const leagues = repository();
    await createLeague({ leagues }).execute({
      name: "Sprinteurs",
      competitionSlugs: ["c"],
      families: ["hurdles", "sprint", "sprint"],
    });
    expect(leagues.families).toEqual([["sprint", "hurdles"]]);
  });

  it("creates a league on all events when no family is chosen", async () => {
    const leagues = repository();
    await createLeague({ leagues }).execute({ name: "Tout", competitionSlugs: ["c"] });
    expect(leagues.families).toEqual([[]]);
  });

  it("refuses an unknown family with LEAGUE_FAMILY_INVALID, without creating anything", async () => {
    const leagues = repository();
    expect(
      await codeOf(
        createLeague({ leagues }).execute({
          name: "Curling",
          competitionSlugs: ["c"],
          families: ["curling"],
        }),
      ),
    ).toBe("LEAGUE_FAMILY_INVALID");
    expect(leagues.created).toEqual([]);
  });

  it("creates a league with the cleaned name", async () => {
    const leagues = repository();

    const created = await createLeague({ leagues }).execute({
      name: "  Les   Foulées ",
      competitionSlugs: ["c"],
    });

    expect(created.name).toBe("Les Foulées");
    expect(leagues.created).toEqual(["Les Foulées"]);
  });

  it("creates a league on several competitions, each counted once", async () => {
    const leagues = repository();

    await createLeague({ leagues }).execute({ name: "Potes", competitionSlugs: ["a", "b", "a"] });

    expect(leagues.competitions).toEqual([["a", "b"]]);
  });

  it("creates a league without competition, to complete later", async () => {
    const leagues = repository();

    await createLeague({ leagues }).execute({ name: "Potes", competitionSlugs: [] });

    expect(leagues.competitions).toEqual([[]]);
  });

  it("refuses an invalid name with LEAGUE_NAME_INVALID, without creating anything", async () => {
    const leagues = repository();

    expect(
      await codeOf(createLeague({ leagues }).execute({ name: "A", competitionSlugs: ["c"] })),
    ).toBe("LEAGUE_NAME_INVALID");
    expect(leagues.created).toEqual([]);
  });
});

describe("joinLeague", () => {
  it("joins with a code typed in lower case with spaces", async () => {
    let asked = "";
    const leagues = repository({
      join: async (code) => {
        asked = code;
        return { outcome: "joined", leagueId: "l1" };
      },
    });

    expect(await joinLeague({ leagues }).execute({ code: "k7m 2qx" })).toBe("l1");
    expect(asked).toBe("K7M2QX");
  });

  it("refuses a code that cannot exist without asking the database", async () => {
    const leagues = repository({
      join: async () => Promise.reject(new Error("should not be called")),
    });

    expect(await codeOf(joinLeague({ leagues }).execute({ code: "OOO000" }))).toBe(
      "LEAGUE_CODE_UNKNOWN",
    );
  });

  it.each([
    ["unknown_code", "LEAGUE_CODE_UNKNOWN"],
    ["full", "LEAGUE_FULL"],
  ] as const)("turns %s into %s", async (outcome, code) => {
    const leagues = repository({ join: async () => ({ outcome }) });

    expect(await codeOf(joinLeague({ leagues }).execute({ code: "K7M2QX" }))).toBe(code);
  });

  it("tells a member he is already in the league", async () => {
    const leagues = repository({
      join: async () => ({ outcome: "already_member", leagueId: "l1" }),
    });

    expect(await codeOf(joinLeague({ leagues }).execute({ code: "K7M2QX" }))).toBe(
      "ALREADY_MEMBER",
    );
  });
});

describe("listMyLeagues", () => {
  it("lists the player's leagues by name", async () => {
    const leagues = repository({
      listMine: async () => [league("2", "Zèbres"), league("1", "athlé club")],
    });

    expect((await listMyLeagues({ leagues }).execute()).map((l) => l.name)).toEqual([
      "athlé club",
      "Zèbres",
    ]);
  });
});

describe("getLeague", () => {
  it("gives a member the league and its members", async () => {
    const leagues = repository({
      listMine: async () => [league("l1", "Club")],
      members: async () => [{ userId: "me", pseudo: "Moi", bib: { number: 7, color: "blue" } }],
    });

    const found = await getLeague({ leagues }).execute({ leagueId: "l1" });

    expect(found.members).toHaveLength(1);
  });

  it("refuses a non member with LEAGUE_NOT_FOUND", async () => {
    expect(await codeOf(getLeague({ leagues: repository() }).execute({ leagueId: "l1" }))).toBe(
      "LEAGUE_NOT_FOUND",
    );
  });
});

describe("leaveLeague and handOverLeague", () => {
  it("asks the owner to hand the league over first", async () => {
    const leagues = repository({ leave: async () => "must_hand_over" });

    expect(await codeOf(leaveLeague({ leagues }).execute({ leagueId: "l1" }))).toBe(
      "LEAGUE_OWNER_MUST_HAND_OVER",
    );
  });

  it.each([
    ["not_owner", "NOT_LEAGUE_OWNER"],
    ["unknown_member", "LEAGUE_MEMBER_UNKNOWN"],
  ] as const)("turns a refused hand-over (%s) into %s", async (outcome, code) => {
    const leagues = repository({ handOver: async () => outcome });

    expect(
      await codeOf(handOverLeague({ leagues }).execute({ leagueId: "l1", newOwnerId: "x" })),
    ).toBe(code);
  });
});

describe("addLeagueCompetition", () => {
  it("adds a coming competition to the league of its creator", async () => {
    const asked: [string, string][] = [];
    const leagues = repository({
      addCompetition: async (leagueId, slug) => {
        asked.push([leagueId, slug]);
        return "added";
      },
    });

    await addLeagueCompetition({ leagues }).execute({ leagueId: "l1", competitionSlug: "euro" });

    expect(asked).toEqual([["l1", "euro"]]);
  });

  it.each([
    ["not_owner", "NOT_LEAGUE_OWNER"],
    ["unknown", "COMPETITION_NOT_FOUND"],
    ["started", "COMPETITION_STARTED"],
  ] as const)("turns %s into %s", async (outcome, code) => {
    const leagues = repository({ addCompetition: async () => outcome });

    expect(
      await codeOf(
        addLeagueCompetition({ leagues }).execute({ leagueId: "l1", competitionSlug: "x" }),
      ),
    ).toBe(code);
  });
});

describe("public leagues", () => {
  it("creates a public league, joined without a code", async () => {
    const leagues = repository();

    await createLeague({ leagues }).execute({
      name: "Les Gazelles",
      competitionSlugs: ["c"],
      isPublic: true,
    });

    expect(leagues.publics).toEqual([true]);
  });

  it("refuses a banned name for a public league with LEAGUE_NAME_BANNED", async () => {
    const leagues = repository();

    expect(
      await codeOf(
        createLeague({ leagues }).execute({
          name: "Ligue officielle",
          competitionSlugs: [],
          isPublic: true,
        }),
      ),
    ).toBe("LEAGUE_NAME_BANNED");
    expect(leagues.created).toEqual([]);
  });

  it("lists the public leagues the player is not in yet, the biggest first", async () => {
    const leagues = repository({
      listMine: async () => [league("mine", "Mienne")],
      listPublic: async () => [
        { id: "small", name: "Petite", memberCount: 2, competitionSlugs: [] },
        { id: "mine", name: "Mienne", memberCount: 9, competitionSlugs: [] },
        { id: "big", name: "Grande", memberCount: 40, competitionSlugs: ["c"] },
      ],
    });

    const listed = await listPublicLeagues({ leagues }).execute();

    expect(listed.map((l) => l.id)).toEqual(["big", "small"]);
  });

  it.each([
    ["full", "LEAGUE_FULL"],
    ["unknown_code", "LEAGUE_NOT_FOUND"],
  ] as const)("turns %s into %s when joining a public league", async (outcome, code) => {
    const leagues = repository({ joinPublic: async () => ({ outcome }) });

    expect(await codeOf(joinPublicLeague({ leagues }).execute({ leagueId: "x" }))).toBe(code);
  });

  it("takes a player already in the public league to it", async () => {
    const leagues = repository({
      joinPublic: async (id) => ({ outcome: "already_member", leagueId: id }),
    });

    expect(await joinPublicLeague({ leagues }).execute({ leagueId: "x" })).toBe("x");
  });
});

describe("reportLeague", () => {
  it("reports a public league, and refuses an unknown one with LEAGUE_NOT_FOUND", async () => {
    const reported: string[] = [];
    const leagues = repository({
      report: async (id) => {
        if (id === "nope") return "unknown";
        reported.push(id);
        return "reported";
      },
    });

    await reportLeague({ leagues }).execute({ leagueId: "pub" });

    expect(reported).toEqual(["pub"]);
    expect(await codeOf(reportLeague({ leagues }).execute({ leagueId: "nope" }))).toBe(
      "LEAGUE_NOT_FOUND",
    );
  });
});

describe("joining with a code, too many wrong codes", () => {
  it("refuses with LEAGUE_TOO_MANY_ATTEMPTS", async () => {
    const leagues = repository({ join: async () => ({ outcome: "too_many" }) });

    expect(await codeOf(joinLeague({ leagues }).execute({ code: "K7M2QX" }))).toBe(
      "LEAGUE_TOO_MANY_ATTEMPTS",
    );
  });
});

describe("addLeagueFamily (#613)", () => {
  it("adds a family to the league of its creator", async () => {
    const asked: [string, string][] = [];
    const leagues = repository({
      addFamily: async (leagueId, family) => {
        asked.push([leagueId, family]);
        return "added";
      },
    });
    await addLeagueFamily({ leagues }).execute({ leagueId: "l1", family: "throws" });
    expect(asked).toEqual([["l1", "throws"]]);
  });

  it("refuses an unknown family with LEAGUE_FAMILY_INVALID", async () => {
    const leagues = repository();
    expect(
      await codeOf(addLeagueFamily({ leagues }).execute({ leagueId: "l1", family: "curling" })),
    ).toBe("LEAGUE_FAMILY_INVALID");
  });

  it.each([
    ["not_owner", "NOT_LEAGUE_OWNER"],
    ["all_events", "LEAGUE_ALL_EVENTS"],
  ] as const)("turns %s into %s", async (outcome, code) => {
    const leagues = repository({ addFamily: async () => outcome });
    expect(
      await codeOf(addLeagueFamily({ leagues }).execute({ leagueId: "l1", family: "throws" })),
    ).toBe(code);
  });
});
