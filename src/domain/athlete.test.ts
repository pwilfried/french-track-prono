import { describe, expect, it } from "vitest";

import { recordRows, type AthleteRecord } from "./athlete";

const record = (
  discipline: string,
  kind: AthleteRecord["kind"],
  mark: string,
  date: string | null,
): AthleteRecord => ({ discipline, kind, mark, date, meeting: null });

describe("recordRows", () => {
  it("puts the PR and the SB of a discipline side by side", () => {
    const rows = recordRows([
      record("100 m", "pr", "10.58", "2026-10-01"),
      record("100 m", "sb", "10.62", "2026-09-12"),
    ]);

    expect(rows).toEqual([
      {
        discipline: "100 m",
        pr: expect.objectContaining({ mark: "10.58" }),
        sb: expect.objectContaining({ mark: "10.62" }),
      },
    ]);
  });

  it("shows the discipline with the most recent record first, and leaves out world records", () => {
    const rows = recordRows([
      record("200 m", "pr", "21.60", "2025-07-01"),
      record("100 m", "sb", "10.62", "2026-09-12"),
      record("100 m", "wr", "10.49", "1988-07-16"),
    ]);

    expect(rows.map((r) => [r.discipline, r.pr?.mark ?? null, r.sb?.mark ?? null])).toEqual([
      ["100 m", null, "10.62"],
      ["200 m", "21.60", null],
    ]);
  });

  it("keeps at most four disciplines", () => {
    const many = ["100 m", "200 m", "400 m", "800 m", "1500 m"].map((d, i) =>
      record(d, "pr", "1", `2026-0${i + 1}-01`),
    );

    expect(recordRows(many)).toHaveLength(4);
    expect(recordRows([])).toEqual([]);
  });
});
