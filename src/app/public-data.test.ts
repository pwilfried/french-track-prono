import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #919: `next build` prerendered « Comment jouer » and waited on Supabase; a slow database made
 * the build fail. While prerendering, `connection()` rejects: the public reads must stop there,
 * before any request reaches the database. At request time they read as before.
 */
const prerendering = { on: false };

vi.mock("next/server", () => ({
  connection: async () => {
    if (prerendering.on) throw new Error("prerender bail out");
  },
}));
vi.mock("next/cache", () => ({
  unstable_cache: <A extends unknown[], R>(read: (...args: A) => Promise<R>) => read,
  updateTag: () => {},
}));

describe("public reads at build time", () => {
  const fetchSpy = vi.fn(
    async () =>
      new Response(JSON.stringify([{ key: "exact_slot", value: 9 }]), {
        headers: { "content-type": "application/json" },
      }),
  );

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubGlobal("fetch", fetchSpy);
    fetchSpy.mockClear();
  });

  afterEach(() => {
    prerendering.on = false;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("never asks Supabase while the page is prerendered", async () => {
    const { publicScale, publicDisciplines } = await import("./public-data");
    prerendering.on = true;

    await expect(publicScale().list()).rejects.toThrow("prerender bail out");
    await expect(publicDisciplines().list()).rejects.toThrow("prerender bail out");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reads the scale from Supabase when a player asks for the page", async () => {
    const { publicScale } = await import("./public-data");

    const rules = await publicScale().list();

    expect(rules).toEqual([{ key: "exact_slot", value: 9 }]);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
