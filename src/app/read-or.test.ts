import { afterEach, describe, expect, it, vi } from "vitest";

import { UseCaseError } from "@/application/errors";

import { readOr } from "./read-or";

describe("readOr", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns what the read gives when it succeeds", async () => {
    expect(await readOr("season", Promise.resolve(12), null)).toBe(12);
  });

  it("returns the fallback and logs the read and the code when a use case fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const value = await readOr(
      "badges",
      Promise.reject(new UseCaseError("RANKING_UNAVAILABLE")),
      null,
    );

    expect(value).toBeNull();
    expect(log).toHaveBeenCalledWith("read failed: badges RANKING_UNAVAILABLE");
  });

  it("lets any other error through", async () => {
    await expect(readOr("clubs", Promise.reject(new Error("boom")), [])).rejects.toThrow("boom");
  });
});
