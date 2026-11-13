import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  createManagerLeague,
  getManagerLeague,
  joinManagerLeague,
  joinPublicManagerLeague,
  launchManagerMercato,
  listMyManagerLeagues,
  setManagerMercato,
  type JoinOutcome,
  type ManagerLeague,
  type ManagerLeagueFile,
  type ManagerLeagueRepository,
  type MercatoSettings,
} from "./manager-leagues";

function repository(
  leagues: ManagerLeague[] = [],
  joinAnswer: JoinOutcome = { outcome: "unknown" },
) {
  const codes: string[] = [];
  const created: { name: string; isPublic: boolean; competitionIds: string[] }[] = [];
  const repo: ManagerLeagueRepository = {
    create: async (name, isPublic, competitionIds) => {
      created.push({ name, isPublic, competitionIds });
      return { id: "league-1" };
    },
    openCompetitions: async () => [],
    listMine: async () => leagues,
    find: async () => null,
    join: async (code) => {
      codes.push(code);
      return joinAnswer;
    },
    joinPublic: async () => joinAnswer,
    listPublic: async () => [],
    setMercato: async () => "set",
    launchMercato: async () => "launched",
  };
  return { repo, created, codes };
}

const six = ["c1", "c2", "c3", "c4", "c5", "c6"];

describe("createManagerLeague", () => {
  it("creates a private league with the name as typed, spaces tidied", async () => {
    const { repo, created } = repository();

    const league = await createManagerLeague({ managerLeagues: repo }).execute({
      name: "  Les   Lanceurs ",
      isPublic: false,
      competitionIds: six,
    });

    expect(league).toEqual({ id: "league-1" });
    expect(created).toEqual([{ name: "Les Lanceurs", isPublic: false, competitionIds: six }]);
  });

  it("refuses fewer than 6 competitions, a competition picked twice counting once", async () => {
    // Given 5 competitions, one of them picked twice
    const { repo, created } = repository();
    // When a player creates a league with them
    const creating = createManagerLeague({ managerLeagues: repo }).execute({
      name: "Les Lanceurs",
      isPublic: false,
      competitionIds: ["c1", "c2", "c3", "c4", "c5", "c5"],
    });
    // Then it is refused: not even a home-and-away season of 4 players
    await expect(creating).rejects.toEqual(new UseCaseError("MANAGER_COMPETITIONS_TOO_FEW"));
    expect(created).toEqual([]);
  });

  it("answers MANAGER_COMPETITIONS_INVALID when a competition is no longer open", async () => {
    const { repo } = repository();
    repo.create = async () => "competitions_refused";

    await expect(
      createManagerLeague({ managerLeagues: repo }).execute({
        name: "Les Lanceurs",
        isPublic: false,
        competitionIds: six,
      }),
    ).rejects.toEqual(new UseCaseError("MANAGER_COMPETITIONS_INVALID"));
  });

  it("refuses a banned word even in a private league", async () => {
    const { repo, created } = repository();

    await expect(
      createManagerLeague({ managerLeagues: repo }).execute({
        name: "Ligue FFA officielle",
        isPublic: false,
        competitionIds: six,
      }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NAME_BANNED"));
    expect(created).toEqual([]);
  });

  it("refuses a name of one letter", async () => {
    const { repo } = repository();

    await expect(
      createManagerLeague({ managerLeagues: repo }).execute({
        name: "A",
        isPublic: true,
        competitionIds: six,
      }),
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
      target: 4,
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

const now = "2027-01-10T00:00:00.000Z";
/** Six competitions, the first starting `firstIn` hours from now, the next ones a week apart. */
const competitions = (firstIn: number) =>
  six.map((id, i) => ({
    id,
    name: `Meeting ${i + 1}`,
    startsAt: new Date(Date.parse(now) + (firstIn + i * 168) * 3_600_000).toISOString(),
  }));

/**
 * A league of `members` players created by u1, its mercato waiting for `target`, its rounds of
 * 24 hours, 2 rounds expected (teams of 2 at least).
 */
function mercatoRepository(
  members: number,
  target = 4,
  openedAt: string | null = null,
  firstIn = 100,
) {
  const league = {
    id: "league-1",
    name: "Les Lanceurs",
    isPublic: false,
    inviteCode: "ABC234",
    ownerId: "u1",
    memberCount: members,
    competitions: competitions(firstIn),
    rules: { minTeamSize: 2, rounds: { firstHours: 24, longRounds: 1, nextHours: 24 } },
    participants: [],
    mercato: { target, startsAt: null, openedAt, roundMode: "auto" },
  } as unknown as ManagerLeagueFile;
  const settings: MercatoSettings[] = [];
  const launched: string[] = [];
  const repo: ManagerLeagueRepository = {
    ...repository().repo,
    find: async () => league,
    setMercato: async (_, s) => {
      settings.push(s);
      return "set";
    },
    launchMercato: async (id) => {
      launched.push(id);
      return "launched";
    },
  };
  return { repo, settings, launched };
}

describe("setManagerMercato", () => {
  it("lets the creator set a start and rounds of 48 then 12 hours", async () => {
    // Given a league of 3 players
    const { repo, settings } = mercatoRepository(3);
    // When its creator sets its mercato
    await setManagerMercato({ managerLeagues: repo, userId: "u1" }).execute({
      id: "league-1",
      startsAt: "2027-01-10T19:00:00.000Z",
      rounds: { mode: "custom", firstHours: 48, nextHours: 12 },
    });
    // Then the settings are kept
    expect(settings).toEqual([
      {
        startsAt: "2027-01-10T19:00:00.000Z",
        rounds: { mode: "custom", firstHours: 48, nextHours: 12 },
      },
    ]);
  });

  it("refuses rounds of 36 hours", async () => {
    const { repo, settings } = mercatoRepository(3);

    await expect(
      setManagerMercato({ managerLeagues: repo, userId: "u1" }).execute({
        id: "league-1",
        startsAt: null,
        rounds: { mode: "custom", firstHours: 36, nextHours: 24 },
      }),
    ).rejects.toEqual(new UseCaseError("MERCATO_ROUNDS_INVALID"));
    expect(settings).toEqual([]);
  });

  it("does not let another participant set the mercato", async () => {
    const { repo } = mercatoRepository(3);

    await expect(
      setManagerMercato({ managerLeagues: repo, userId: "u2" }).execute({
        id: "league-1",
        startsAt: null,
        rounds: { mode: "auto" },
      }),
    ).rejects.toEqual(new UseCaseError("NOT_LEAGUE_OWNER"));
  });

  it("does not set a mercato already open", async () => {
    const { repo } = mercatoRepository(4, 4, "2027-01-01T08:00:00.000Z");

    await expect(
      setManagerMercato({ managerLeagues: repo, userId: "u1" }).execute({
        id: "league-1",
        startsAt: null,
        rounds: { mode: "auto" },
      }),
    ).rejects.toEqual(new UseCaseError("MERCATO_OPEN"));
  });
});

describe("launchManagerMercato", () => {
  it("launches the mercato once the 4 players are in", async () => {
    // Given a league of 4 players waiting for 4, its 6 competitions after the mercato
    const { repo, launched } = mercatoRepository(4);
    // When its creator launches the mercato
    await launchManagerMercato({ managerLeagues: repo, userId: "u1" }).execute({
      id: "league-1",
      now,
    });
    // Then it opens
    expect(launched).toEqual(["league-1"]);
  });

  it("waits while a player is missing", async () => {
    const { repo, launched } = mercatoRepository(3);

    await expect(
      launchManagerMercato({ managerLeagues: repo, userId: "u1" }).execute({ id: "league-1", now }),
    ).rejects.toEqual(new UseCaseError("MERCATO_PLAYERS_MISSING"));
    expect(launched).toEqual([]);
  });

  it("refuses when the mercato would end less than 1 h before the first competition", async () => {
    // Given 6 competitions for 4 players, the first starting 48 h from now, and a mercato of 48 h
    const { repo, launched } = mercatoRepository(4, 4, null, 48);
    // When its creator launches the mercato now
    const launching = launchManagerMercato({ managerLeagues: repo, userId: "u1" }).execute({
      id: "league-1",
      now,
    });
    // Then it stays shut: 5 competitions left, the home-and-away season needs 6
    await expect(launching).rejects.toEqual(new UseCaseError("MERCATO_COMPETITIONS_SHORT"));
    expect(launched).toEqual([]);
  });

  it("does not let another participant launch it", async () => {
    const { repo } = mercatoRepository(4);

    await expect(
      launchManagerMercato({ managerLeagues: repo, userId: "u2" }).execute({ id: "league-1", now }),
    ).rejects.toEqual(new UseCaseError("NOT_LEAGUE_OWNER"));
  });
});
