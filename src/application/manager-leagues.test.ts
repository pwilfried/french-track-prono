import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  createManagerLeague,
  getManagerLeague,
  joinManagerLeague,
  joinPublicManagerLeague,
  launchManagerMercato,
  listMyManagerLeagues,
  setManagerCompetitions,
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
    availableCompetitions: async () => [],
    create: async (name, isPublic, competitionIds) => {
      created.push({ name, isPublic, competitionIds });
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
    setCompetitions: async () => "set",
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

  it("creates a league on the competitions chosen, each once", async () => {
    // Given 6 competitions, one of them ticked twice
    const { repo, created } = repository();
    // When the player creates the league
    await createManagerLeague({ managerLeagues: repo }).execute({
      name: "Les Sauteurs",
      isPublic: true,
      competitionIds: [...six, "c1"],
    });
    // Then each competition is kept once
    expect(created[0]?.competitionIds).toEqual(six);
  });

  it("refuses fewer than 6 competitions", async () => {
    const { repo, created } = repository();

    await expect(
      createManagerLeague({ managerLeagues: repo }).execute({
        name: "Les Sauteurs",
        isPublic: true,
        competitionIds: six.slice(1),
      }),
    ).rejects.toEqual(new UseCaseError("MANAGER_COMPETITIONS_TOO_FEW"));
    expect(created).toEqual([]);
  });

  it("refuses competitions the database does not offer", async () => {
    const { repo } = repository();
    repo.create = async () => "competitions_refused";

    await expect(
      createManagerLeague({ managerLeagues: repo }).execute({
        name: "Les Sauteurs",
        isPublic: true,
        competitionIds: six,
      }),
    ).rejects.toEqual(new UseCaseError("MANAGER_COMPETITIONS_REFUSED"));
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

/** Competitions whose first events are `days` after 2027-01-01 08:00 UTC, one a week by default. */
const competitionsFrom = (days: number[]) =>
  days.map((d, i) => ({
    id: `c${i + 1}`,
    name: `Meeting ${i + 1}`,
    firstEventAt: new Date(Date.parse("2027-01-01T08:00:00.000Z") + d * 86_400_000).toISOString(),
  }));
const weekly = (n: number) => competitionsFrom(Array.from({ length: n }, (_, i) => 10 + 7 * i));

/** A league of `members` players created by u1, its mercato waiting for `target`. */
function mercatoRepository(
  members: number,
  target = 4,
  openedAt: string | null = null,
  competitions = weekly(6),
) {
  const league = {
    id: "league-1",
    name: "Les Lanceurs",
    isPublic: false,
    inviteCode: "ABC234",
    ownerId: "u1",
    memberCount: members,
    competitions,
    participants: [],
    rules: { rounds: { firstHours: 24, longRounds: 1, nextHours: 24 } },
    mercato: { target, startsAt: null, openedAt, roundMode: "auto" },
  } as unknown as ManagerLeagueFile;
  const settings: MercatoSettings[] = [];
  const chosen: string[][] = [];
  const launched: string[] = [];
  const repo: ManagerLeagueRepository = {
    ...repository().repo,
    find: async () => league,
    setCompetitions: async (_, ids) => {
      chosen.push(ids);
      return "set";
    },
    setMercato: async (_, s) => {
      settings.push(s);
      return "set";
    },
    launchMercato: async (id) => {
      launched.push(id);
      return "launched";
    },
  };
  return { repo, settings, chosen, launched };
}

const now = "2027-01-01T08:00:00.000Z";

describe("setManagerCompetitions", () => {
  it("lets the creator choose 10 competitions for 6 players while 3 are in", async () => {
    // Given a league of 3 players
    const { repo, chosen } = mercatoRepository(3);
    const ten = weekly(10).map((c) => c.id);
    // When its creator chooses 10 competitions
    await setManagerCompetitions({ managerLeagues: repo, userId: "u1" }).execute({
      id: "league-1",
      competitionIds: ten,
    });
    // Then they are kept
    expect(chosen).toEqual([ten]);
  });

  it("never derives fewer players than those already in", async () => {
    const { repo, chosen } = mercatoRepository(5, 6, null, weekly(10));

    await expect(
      setManagerCompetitions({ managerLeagues: repo, userId: "u1" }).execute({
        id: "league-1",
        competitionIds: six,
      }),
    ).rejects.toEqual(new UseCaseError("MANAGER_COMPETITIONS_UNDER_PLAYERS"));
    expect(chosen).toEqual([]);
  });

  it("refuses fewer than 6 competitions", async () => {
    const { repo } = mercatoRepository(1);

    await expect(
      setManagerCompetitions({ managerLeagues: repo, userId: "u1" }).execute({
        id: "league-1",
        competitionIds: six.slice(1),
      }),
    ).rejects.toEqual(new UseCaseError("MANAGER_COMPETITIONS_TOO_FEW"));
  });

  it("does not let another participant choose them", async () => {
    const { repo } = mercatoRepository(3);

    await expect(
      setManagerCompetitions({ managerLeagues: repo, userId: "u2" }).execute({
        id: "league-1",
        competitionIds: six,
      }),
    ).rejects.toEqual(new UseCaseError("NOT_LEAGUE_OWNER"));
  });
});

describe("setManagerMercato", () => {
  it("lets the creator set rounds of 48 then 12 hours and a start", async () => {
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
    const { repo, settings } = mercatoRepository(5, 6);

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
    // Given a league of 4 players waiting for 4, its 6 competitions well after the mercato
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
      launchManagerMercato({ managerLeagues: repo, userId: "u1" }).execute({
        id: "league-1",
        now,
      }),
    ).rejects.toEqual(new UseCaseError("MERCATO_PLAYERS_MISSING"));
    expect(launched).toEqual([]);
  });

  it("refuses to launch when the mercato would end after the first competition of 6", async () => {
    // Given 6 competitions, the first one 2 days away: 3 rounds of 24 hours end after it
    const { repo, launched } = mercatoRepository(
      4,
      4,
      null,
      competitionsFrom([2, 10, 17, 24, 31, 38]),
    );
    // When its creator launches the mercato, then it is refused
    await expect(
      launchManagerMercato({ managerLeagues: repo, userId: "u1" }).execute({
        id: "league-1",
        now,
      }),
    ).rejects.toEqual(new UseCaseError("MERCATO_COMPETITIONS_MISSING"));
    expect(launched).toEqual([]);
  });

  it("launches when a competition left over replaces the one the mercato misses", async () => {
    const { repo, launched } = mercatoRepository(
      4,
      4,
      null,
      competitionsFrom([2, 10, 17, 24, 31, 38, 45]),
    );

    await launchManagerMercato({ managerLeagues: repo, userId: "u1" }).execute({
      id: "league-1",
      now,
    });
    expect(launched).toEqual(["league-1"]);
  });

  it("does not let another participant launch it", async () => {
    const { repo } = mercatoRepository(4);

    await expect(
      launchManagerMercato({ managerLeagues: repo, userId: "u2" }).execute({
        id: "league-1",
        now,
      }),
    ).rejects.toEqual(new UseCaseError("NOT_LEAGUE_OWNER"));
  });
});
