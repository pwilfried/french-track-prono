import { describe, expect, it } from "vitest";

import { disciplineRecords, type SheetRecord } from "./athlete";

const record = (
  discipline: string,
  kind: SheetRecord["kind"],
  mark: string,
  date: string | null,
  verified = true,
): SheetRecord => ({ discipline, kind, mark, date, meeting: null, verified });

describe("disciplineRecords", () => {
  it("puts the PB and the SB of the current season of a discipline together", () => {
    const blocks = disciplineRecords(
      {
        disciplines: ["100 m"],
        records: [
          record("100 m", "pr", "10.58", "2025-08-01"),
          record("100 m", "sb", "10.62", "2026-09-12"),
        ],
      },
      2026,
    );

    expect(blocks).toEqual([
      {
        discipline: "100 m",
        main: true,
        pb: expect.objectContaining({ mark: "10.58" }),
        sb: expect.objectContaining({ mark: "10.62" }),
      },
    ]);
  });

  it("leaves out a season best of an earlier season", () => {
    const blocks = disciplineRecords(
      {
        disciplines: ["100 m"],
        records: [
          record("100 m", "pr", "10.58", "2025-08-01"),
          record("100 m", "sb", "10.58", "2025-08-01"),
        ],
      },
      2026,
    );

    expect(blocks[0]?.sb).toBeNull();
    expect(blocks[0]?.pb?.mark).toBe("10.58");
  });

  it("shows the main discipline first, then the others, and leaves out world records", () => {
    const blocks = disciplineRecords(
      {
        disciplines: ["200 m", "100 m"],
        records: [
          record("100 m", "pr", "10.65", "2023-08-21"),
          record("400 m", "pr", "50.10", "2026-05-01"),
          record("200 m", "pr", "21.92", "2023-08-25"),
          record("200 m", "wr", "21.34", "1988-09-29"),
        ],
      },
      2026,
    );

    expect(blocks.map((b) => [b.discipline, b.main])).toEqual([
      ["200 m", true],
      ["100 m", false],
      ["400 m", false],
    ]);
  });

  it("orders disciplines outside the athlete's list by their latest record", () => {
    const blocks = disciplineRecords(
      {
        disciplines: [],
        records: [
          record("800 m", "pr", "1:58.00", "2024-06-01"),
          record("1500 m", "sb", "4:01.00", "2026-06-01"),
        ],
      },
      2026,
    );

    expect(blocks.map((b) => b.discipline)).toEqual(["1500 m", "800 m"]);
  });

  it("gives nothing for an athlete without a record, even with disciplines", () => {
    expect(disciplineRecords({ disciplines: ["100 m"], records: [] }, 2026)).toEqual([]);
  });

  it("keeps a season best without a date: it cannot be told stale", () => {
    const blocks = disciplineRecords(
      { disciplines: ["100 m"], records: [record("100 m", "sb", "10.90", null)] },
      2026,
    );

    expect(blocks[0]?.sb?.mark).toBe("10.90");
  });

  it("does not repeat a season best equal to the personal best (#938)", () => {
    const blocks = disciplineRecords(
      {
        disciplines: ["100 m"],
        records: [
          record("100 m", "pr", "10.95", "2026-07-14", false),
          record("100 m", "sb", "10.95", "2026-07-14", false),
        ],
      },
      2026,
    );

    expect(blocks).toEqual([
      {
        discipline: "100 m",
        main: true,
        pb: expect.objectContaining({ mark: "10.95" }),
        sb: null,
      },
    ]);
  });
});
