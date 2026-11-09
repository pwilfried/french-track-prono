import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  deleteReportedLeague,
  dismissLeagueReports,
  getLeagueMembers,
  listAdminLeagues,
  removeLeagueMember,
  renameReportedLeague,
  type AdminLeague,
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
    list: async () => [],
    members: async () => [],
    dismissReports: async () => "done",
    removeMember: async () => "done",
    rename: async () => "done",
    remove: async () => "done",
    ...overrides,
  };
}

describe("league moderation", () => {
  it("lists every league for the admin", async () => {
    const leagues: AdminLeague[] = [
      {
        id: "l1",
        name: "Douteuse",
        emoji: "🏆",
        isPublic: true,
        owner: "Patronne",
        createdAt: "2026-11-08T10:00:00.000Z",
        memberCount: 12,
        reportCount: 3,
        competitions: ["Championnats d'Europe"],
      },
    ];

    expect(
      await listAdminLeagues({ moderation: repository({ list: async () => leagues }) }).execute(),
    ).toEqual(leagues);
  });

  it("gives the members of a league with their rank", async () => {
    const members = [
      {
        userId: "u1",
        pseudo: "Gazelle",
        avatar: "🦌",
        isOwner: true,
        joinedAt: "2026-11-08T10:00:00.000Z",
        points: 12,
        rank: 1,
      },
    ];
    expect(
      await getLeagueMembers({ moderation: repository({ members: async () => members }) }).execute({
        leagueId: "l1",
      }),
    ).toEqual(members);
  });

  it("dismisses the reports of a league", async () => {
    const dismissed: string[] = [];
    const moderation = repository({
      dismissReports: async (id) => {
        dismissed.push(id);
        return "done";
      },
    });
    await dismissLeagueReports({ moderation }).execute({ leagueId: "l1" });
    expect(dismissed).toEqual(["l1"]);
  });

  it("removes a member, never the owner", async () => {
    expect(
      await codeOf(
        removeLeagueMember({ moderation: repository() }).execute({ leagueId: "l1", userId: "u2" }),
      ),
    ).toBe("no error");
    expect(
      await codeOf(
        removeLeagueMember({
          moderation: repository({ removeMember: async () => "owner" }),
        }).execute({ leagueId: "l1", userId: "u1" }),
      ),
    ).toBe("LEAGUE_OWNER_STAYS");
    expect(
      await codeOf(
        removeLeagueMember({
          moderation: repository({ removeMember: async () => "unknown" }),
        }).execute({ leagueId: "l1", userId: "zz" }),
      ),
    ).toBe("LEAGUE_MEMBER_UNKNOWN");
  });

  it("refuses a player who is not admin with NOT_ADMIN", async () => {
    const moderation = repository({
      list: async () => "not_admin",
      members: async () => "not_admin",
      dismissReports: async () => "not_admin",
      removeMember: async () => "not_admin",
      rename: async () => "not_admin",
      remove: async () => "not_admin",
    });

    expect(await codeOf(listAdminLeagues({ moderation }).execute())).toBe("NOT_ADMIN");
    expect(await codeOf(getLeagueMembers({ moderation }).execute({ leagueId: "l1" }))).toBe(
      "NOT_ADMIN",
    );
    expect(await codeOf(dismissLeagueReports({ moderation }).execute({ leagueId: "l1" }))).toBe(
      "NOT_ADMIN",
    );
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
