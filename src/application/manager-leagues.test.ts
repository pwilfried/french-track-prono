import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  createManagerLeague,
  getManagerLeague,
  listMyManagerLeagues,
  type ManagerLeague,
  type ManagerLeagueRepository,
} from "./manager-leagues";

function repository(leagues: ManagerLeague[] = []) {
  const created: { name: string; isPublic: boolean }[] = [];
  const repo: ManagerLeagueRepository = {
    create: async (name, isPublic) => {
      created.push({ name, isPublic });
      return { id: "league-1" };
    },
    listMine: async () => leagues,
    find: async () => null,
  };
  return { repo, created };
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
