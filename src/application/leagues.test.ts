import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  createLeague,
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
});

function repository(
  overrides: Partial<LeagueRepository> = {},
): LeagueRepository & { created: string[]; competitions: string[][] } {
  const created: string[] = [];
  const competitions: string[][] = [];
  return {
    created,
    competitions,
    create: async (name, slugs) => {
      created.push(name);
      competitions.push(slugs);
      return league("new", name);
    },
    join: async () => ({ outcome: "joined", leagueId: "l1" }),
    listMine: async () => [],
    members: async () => null,
    leave: async () => "left",
    handOver: async () => "done",
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

  it("refuses a league without competition with LEAGUE_NO_COMPETITION", async () => {
    const leagues = repository();

    expect(
      await codeOf(createLeague({ leagues }).execute({ name: "Potes", competitionSlugs: [] })),
    ).toBe("LEAGUE_NO_COMPETITION");
    expect(leagues.created).toEqual([]);
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
      members: async () => [{ userId: "me", pseudo: "Moi", avatar: "🦅" }],
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
