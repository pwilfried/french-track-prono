import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Profile } from "@/application/create-profile";
import type { CurrentUser } from "@/infra";

import { readProxiedSession, SESSION_HEADER } from "./app/proxied-session";

const auth = vi.hoisted(() => ({
  user: null as CurrentUser | null,
  profile: null as Profile | null,
  userChecks: 0,
}));

vi.mock("@/infra", () => ({
  createSessionClient: () => ({}),
  readCurrentUser: async () => {
    auth.userChecks += 1;
    return auth.user;
  },
  createSupabaseProfileRepository: () => ({ find: async () => auth.profile }),
}));

const { proxy } = await import("./proxy");

const player: CurrentUser = { userId: "u-1", email: "élodie@example.test" };
const profile: Profile = {
  userId: "u-1",
  pseudo: "Sprinteuse",
  bib: { number: 7, color: "blue" },
  ageConfirmedAt: new Date("2026-01-02T03:04:05.000Z"),
};

/** The request headers the proxy hands to the page (Next.js forwards them this way). */
function forwardedTo(response: Response): Headers {
  const names = response.headers.get("x-middleware-override-headers")?.split(",") ?? [];
  const headers = new Headers();
  for (const name of names) {
    const value = response.headers.get(`x-middleware-request-${name}`);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

function request(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(new URL(path, "http://localhost"), init);
}

const forged = encodeURIComponent(JSON.stringify({ user: player }));

describe("proxy", () => {
  beforeEach(() => {
    auth.user = null;
    auth.profile = null;
    auth.userChecks = 0;
  });

  it("tells the page a visitor is a visitor, even with a forged session header", async () => {
    const response = await proxy(request("/", { headers: { [SESSION_HEADER]: forged } }));

    expect(readProxiedSession(forwardedTo(response))).toEqual({ user: null });
  });

  it("hands the page the user and the profile it checked, once", async () => {
    auth.user = player;
    auth.profile = profile;

    const response = await proxy(request("/profil"));

    expect(readProxiedSession(forwardedTo(response))).toEqual({ user: player, profile });
    expect(auth.userChecks).toBe(1);
  });

  it("hands the user without profile on a page that does not need one", async () => {
    auth.user = player;

    const response = await proxy(request("/connexion"));

    expect(readProxiedSession(forwardedTo(response))).toEqual({ user: player });
  });

  it("drops a forged session header on a server action, which checks the user again", async () => {
    const response = await proxy(
      request("/profil", { method: "POST", headers: { [SESSION_HEADER]: forged } }),
    );

    expect(readProxiedSession(forwardedTo(response))).toBeUndefined();
  });
});
