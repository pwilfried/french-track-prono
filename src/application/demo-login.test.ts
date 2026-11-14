import { describe, expect, it } from "vitest";

import type { ProfileRepository } from "./create-profile";
import { listDemoPlayers, signInAsDemoPlayer, type DemoAccounts } from "./demo-login";
import { UseCaseError } from "./errors";

// Application tests do not import the infra layer: a few lines of fake are enough here.
const accounts = [
  { userId: "d1", pseudo: "Démo Gazelle", email: "demo-1@example.test" },
  { userId: "d2", pseudo: "Démo Perche", email: "demo-2@example.test" },
  { userId: "real", pseudo: "Vrai joueur", email: "someone@gmail.com" },
  { userId: "boss", pseudo: "Admin", email: "boss@example.test" },
];

function fakeDemo(): DemoAccounts & { issued: string[] } {
  const issued: string[] = [];
  return {
    issued,
    async listDemoPlayers() {
      // A careless adapter: everything comes back, the use case filters.
      return accounts.map(({ userId, pseudo, email }) => ({ userId, pseudo, email }));
    },
    async find(userId) {
      return accounts.find((a) => a.userId === userId) ?? null;
    },
    async signInToken(userId) {
      issued.push(userId);
      return `token-${userId}`;
    },
  };
}

const profiles = (admins: string[]): ProfileRepository => ({
  find: async () => null,
  create: async () => "created",
  isAdmin: async (userId) => admins.includes(userId),
  update: async () => "updated",
  deleteMine: async () => {},
});

const ports = (enabled: boolean) => ({ enabled, profiles: profiles(["boss"]), demo: fakeDemo() });

describe("listing the demo players", () => {
  it("gives an admin of pre-production the invented accounts only, admins left out", async () => {
    const players = await listDemoPlayers(ports(true)).execute({ userId: "boss" });

    expect(players.map((p) => p.pseudo)).toEqual(["Démo Gazelle", "Démo Perche"]);
  });

  it("does not exist outside pre-production", async () => {
    await expect(listDemoPlayers(ports(false)).execute({ userId: "boss" })).rejects.toEqual(
      new UseCaseError("DEMO_LOGIN_DISABLED"),
    );
  });

  it("refuses a player who is not an admin", async () => {
    await expect(listDemoPlayers(ports(true)).execute({ userId: "d1" })).rejects.toEqual(
      new UseCaseError("NOT_ADMIN"),
    );
  });
});

describe("signing in as a demo player", () => {
  it("gives an admin of pre-production a sign-in token for an invented account", async () => {
    const given = ports(true);

    const signIn = await signInAsDemoPlayer(given).execute({ userId: "boss", targetId: "d2" });

    expect(signIn).toEqual({ token: "token-d2", pseudo: "Démo Perche" });
  });

  it("does not exist outside pre-production, even for an admin", async () => {
    const given = ports(false);

    await expect(
      signInAsDemoPlayer(given).execute({ userId: "boss", targetId: "d1" }),
    ).rejects.toEqual(new UseCaseError("DEMO_LOGIN_DISABLED"));
    expect(given.demo.issued).toEqual([]);
  });

  it("refuses a player who is not an admin", async () => {
    const given = ports(true);

    await expect(
      signInAsDemoPlayer(given).execute({ userId: "d1", targetId: "d2" }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
    expect(given.demo.issued).toEqual([]);
  });

  it("refuses an account whose e-mail is not on example.test", async () => {
    const given = ports(true);

    await expect(
      signInAsDemoPlayer(given).execute({ userId: "boss", targetId: "real" }),
    ).rejects.toEqual(new UseCaseError("DEMO_PLAYER_ONLY"));
    expect(given.demo.issued).toEqual([]);
  });

  it("refuses an admin account and an unknown one", async () => {
    const given = ports(true);

    for (const targetId of ["boss", "nobody"]) {
      await expect(signInAsDemoPlayer(given).execute({ userId: "boss", targetId })).rejects.toEqual(
        new UseCaseError("DEMO_PLAYER_ONLY"),
      );
    }
    expect(given.demo.issued).toEqual([]);
  });
});
