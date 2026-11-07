import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { countdown, eventPhase, splitDuration } from "./countdown";

const lockAt = "2026-09-12T18:30:00.000Z";
const at = (offsetMs: number) => new Date(Date.parse(lockAt) + offsetMs);

describe("eventPhase", () => {
  it("is open one second before the lock", () => {
    expect(eventPhase(at(-1000), lockAt)).toBe("open");
  });

  it("is locked exactly at the lock time, like the database", () => {
    expect(eventPhase(at(0), lockAt)).toBe("locked");
  });

  it("is locked after the lock time", () => {
    expect(eventPhase(at(1000), lockAt)).toBe("locked");
  });

  it("never goes back to open as time passes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1e9, max: 1e9 }),
        fc.integer({ min: 0, max: 1e9 }),
        (start, step) => {
          if (eventPhase(at(start), lockAt) === "locked") {
            expect(eventPhase(at(start + step), lockAt)).toBe("locked");
          }
        },
      ),
    );
  });
});

describe("countdown", () => {
  it("counts one second left one second before the lock", () => {
    expect(countdown(at(-1000), lockAt)).toEqual({
      phase: "open",
      remainingSeconds: 1,
      level: "very-soon",
    });
  });

  it("rounds a part of a second up, so it never shows 0 while still open", () => {
    expect(countdown(at(-1), lockAt)).toEqual({
      phase: "open",
      remainingSeconds: 1,
      level: "very-soon",
    });
  });

  it("is locked exactly at the lock time", () => {
    expect(countdown(at(0), lockAt)).toEqual({ phase: "locked" });
  });

  it("is locked after the lock time", () => {
    expect(countdown(at(60_000), lockAt)).toEqual({ phase: "locked" });
  });

  it.each([
    ["two days before", -2 * 24 * 3600_000, "far"],
    ["just over an hour before", -3601_000, "far"],
    ["exactly one hour before", -3600_000, "soon"],
    ["30 minutes before", -30 * 60_000, "soon"],
    ["just over ten minutes before", -601_000, "soon"],
    ["exactly ten minutes before", -600_000, "very-soon"],
    ["one minute before", -60_000, "very-soon"],
  ] as const)("is at level %s", (_, offset, level) => {
    expect(countdown(at(offset), lockAt)).toMatchObject({ phase: "open", level });
  });

  it("only gets more urgent as time passes", () => {
    const rank = { far: 0, soon: 1, "very-soon": 2 } as const;
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1e9 }),
        fc.integer({ min: 0, max: 1e9 }),
        (before, step) => {
          const first = countdown(at(-before), lockAt);
          const later = countdown(at(-before + Math.min(step, before - 1)), lockAt);
          if (first.phase === "open" && later.phase === "open") {
            expect(rank[later.level]).toBeGreaterThanOrEqual(rank[first.level]);
          }
        },
      ),
    );
  });
});

describe("splitDuration", () => {
  it("splits seconds into days, hours, minutes and seconds", () => {
    expect(splitDuration(2 * 86400 + 3 * 3600 + 4 * 60 + 5)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    });
  });

  it("splits zero into zeros", () => {
    expect(splitDuration(0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("adds back to the same number of seconds", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e8 }), (total) => {
        const { days, hours, minutes, seconds } = splitDuration(total);
        expect(days * 86400 + hours * 3600 + minutes * 60 + seconds).toBe(total);
        expect(hours).toBeLessThan(24);
        expect(minutes).toBeLessThan(60);
        expect(seconds).toBeLessThan(60);
      }),
    );
  });
});
