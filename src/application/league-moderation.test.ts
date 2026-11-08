import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  deleteReportedLeague,
  listReportedLeagues,
  renameReportedLeague,
  type LeagueModerationRepository,
} from "./league-moderation";

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "no error";
  } catch (error) {
    return error instanceof UseCaseError ? error.code : String(error);
  }
};

function repository(
  overrides: Partial<LeagueModerationRepository> = {},
): LeagueModerationRepository {
  return {
    listReported: async () => [],
    rename: async () => "done",
    remove: async () => "done",
    ...overrides,
  };
}

describe("league moderation", () => {
  it("lists the reported leagues for the admin", async () => {
    const leagues = [{ id: "l1", name: "Douteuse", reportCount: 3, memberCount: 12 }];

    expect(
      await listReportedLeagues({
        moderation: repository({ listReported: async () => leagues }),
      }).execute(),
    ).toEqual(leagues);
  });

  it("refuses a player who is not admin with NOT_ADMIN", async () => {
    const moderation = repository({
      listReported: async () => "not_admin",
      rename: async () => "not_admin",
      remove: async () => "not_admin",
    });

    expect(await codeOf(listReportedLeagues({ moderation }).execute())).toBe("NOT_ADMIN");
    expect(
      await codeOf(
        renameReportedLeague({ moderation }).execute({ leagueId: "l1", name: "Nouveau" }),
      ),
    ).toBe("NOT_ADMIN");
    expect(await codeOf(deleteReportedLeague({ moderation }).execute({ leagueId: "l1" }))).toBe(
      "NOT_ADMIN",
    );
  });

  it("renames with the cleaned name, and refuses a banned or invalid one", async () => {
    const asked: string[] = [];
    const moderation = repository({
      rename: async (_, name) => {
        asked.push(name);
        return "done";
      },
    });

    await renameReportedLeague({ moderation }).execute({
      leagueId: "l1",
      name: "  Les   Gazelles ",
    });
    expect(asked).toEqual(["Les Gazelles"]);
    expect(
      await codeOf(
        renameReportedLeague({ moderation }).execute({ leagueId: "l1", name: "La FFA" }),
      ),
    ).toBe("LEAGUE_NAME_BANNED");
    expect(
      await codeOf(renameReportedLeague({ moderation }).execute({ leagueId: "l1", name: "A" })),
    ).toBe("LEAGUE_NAME_INVALID");
    expect(asked).toEqual(["Les Gazelles"]);
  });

  it("turns an unknown league into LEAGUE_NOT_FOUND", async () => {
    const moderation = repository({ remove: async () => "unknown", rename: async () => "unknown" });

    expect(await codeOf(deleteReportedLeague({ moderation }).execute({ leagueId: "x" }))).toBe(
      "LEAGUE_NOT_FOUND",
    );
    expect(
      await codeOf(
        renameReportedLeague({ moderation }).execute({ leagueId: "x", name: "Nouveau" }),
      ),
    ).toBe("LEAGUE_NOT_FOUND");
  });
});
