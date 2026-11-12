import { describe, expect, it } from "vitest";

import { readAll } from "./read-all";

/** A server that answers at most `cap` rows of `total`, like PostgREST and its max_rows. */
const server = (total: number, cap: number) => {
  const calls: [number, number][] = [];
  const rows = Array.from({ length: total }, (_, i) => i);
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null };
  };
  return { page, calls };
};

describe("readAll", () => {
  it("reads every row past the cap of one answer", async () => {
    const { page } = server(2497, 1000);
    const { data } = await readAll(page);
    expect(data).toHaveLength(2497);
    expect(data?.at(-1)).toBe(2496);
  });

  it("still reads every row when the server caps below the page size", async () => {
    const { page } = server(1201, 500);
    const { data } = await readAll(page);
    expect(data).toEqual(Array.from({ length: 1201 }, (_, i) => i));
  });

  it("asks the next page right after the rows already read", async () => {
    const { page, calls } = server(1500, 1000);
    await readAll(page);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [1500, 2499],
    ]);
  });

  it("returns the error of a page and no rows", async () => {
    let call = 0;
    const result = await readAll(async () =>
      call++ === 0
        ? { data: Array.from({ length: 1000 }, (_, i) => i), error: null }
        : { data: null, error: { code: "42501" } },
    );
    expect(result).toEqual({ data: null, error: { code: "42501" } });
  });
});
