import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  createManagerLeague,
  getManagerLeague,
  joinManagerLeague,
  joinPublicManagerLeague,
  listMyManagerLeagues,
  type JoinOutcome,
  type ManagerLeague,
  type ManagerLeagueRepository,
} from "./manager-leagues";

function repository(
  leagues: ManagerLeague[] = [],
  joinAnswer: JoinOutcome = { outcome: "unknown" },
) {
  const codes: string[] = [];
  const created: { name: string; isPublic: boolean }[] = [];
  const repo: ManagerLeagueRepository = {
    create: async (name, isPublic) => {
      created.push({ name, isPublic });
      return { id: "league-1" };
    },
    listMine: async () => leagues,
    find: async () => null,
    join: async (code) => {
      codes.push(code);
      return joinAnswer;
    },
    joinPublic: async () => joinAnswer,
    listPublic: async () => [],
  };
  return { repo, created, codes };
}

describe("createManagerLeague", () => {
  it("creates a private league with the name as typed, spaces tidied", async () => {
    const { repo, created } = repository();

    const league = await createManagerLeague({ managerLeagues: repo }).execute({
      name: "  Les   Lanceurs ",
      isPublic: false,
    });

    expect(league).toEqual({ id: "league-1" });
    expect(created).toEqual([{ name: "Les Lanceurs", isPublic: false }]);
  });

  it("refuses a banned word even in a private league", async () => {
    const { repo, created } = repository();

    await expect(
      createManagerLeague({ managerLeagues: repo }).execute({
        name: "Ligue FFA officielle",
        isPublic: false,
      }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NAME_BANNED"));
    expect(created).toEqual([]);
  });

  it("refuses a name of one letter", async () => {
    const { repo } = repository();

    await expect(
      createManagerLeague({ managerLeagues: repo }).execute({ name: "A", isPublic: true }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NAME_INVALID"));
  });
});

describe("listMyManagerLeagues", () => {
  it("lists the player's leagues by name", async () => {
    const league = (name: string): ManagerLeague => ({
      id: name,
      name,
      isPublic: false,
      inviteCode: "ABC234",
      ownerId: "u1",
      memberCount: 1,
    });
    const { repo } = repository([league("Zèbres"), league("Antilopes")]);

    const names = (await listMyManagerLeagues({ managerLeagues: repo }).execute()).map(
      (l) => l.name,
    );

    expect(names).toEqual(["Antilopes", "Zèbres"]);
  });
});

describe("getManagerLeague", () => {
  it("answers LEAGUE_NOT_FOUND for a league the player is not in", async () => {
    const { repo } = repository();

    await expect(getManagerLeague({ managerLeagues: repo }).execute({ id: "x" })).rejects.toEqual(
      new UseCaseError("LEAGUE_NOT_FOUND"),
    );
  });
});

describe("joinManagerLeague", () => {
  it("joins with a code typed in lower case with a space", async () => {
    const { repo, codes } = repository([], { outcome: "joined", leagueId: "league-1" });

    const id = await joinManagerLeague({ managerLeagues: repo }).execute({ code: "k7m 2qx" });

    expect(id).toBe("league-1");
    expect(codes).toEqual(["K7M2QX"]);
  });

  it("answers LEAGUE_CODE_UNKNOWN without asking for a code that cannot exist", async () => {
    const { repo, codes } = repository();

    await expect(
      joinManagerLeague({ managerLeagues: repo }).execute({ code: "OOOOOO" }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_CODE_UNKNOWN"));
    expect(codes).toEqual([]);
  });

  it.each([
    ["full", "LEAGUE_FULL"],
    ["mercato_open", "MERCATO_OPEN"],
    ["too_many", "LEAGUE_TOO_MANY_ATTEMPTS"],
    ["unknown", "LEAGUE_CODE_UNKNOWN"],
  ] as const)("turns %s into %s", async (outcome, code) => {
    const { repo } = repository([], { outcome });

    await expect(
      joinManagerLeague({ managerLeagues: repo }).execute({ code: "K7M2QX" }),
    ).rejects.toEqual(new UseCaseError(code));
  });
});

describe("joinPublicManagerLeague", () => {
  it("answers LEAGUE_NOT_FOUND for a league that is not public", async () => {
    const { repo } = repository();

    await expect(
      joinPublicManagerLeague({ managerLeagues: repo }).execute({ id: "league-1" }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });

  it("refuses a full league with LEAGUE_FULL", async () => {
    const { repo } = repository([], { outcome: "full" });

    await expect(
      joinPublicManagerLeague({ managerLeagues: repo }).execute({ id: "league-1" }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_FULL"));
  });
});
