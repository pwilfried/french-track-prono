import { describe, expect, it } from "vitest";

import type { LineupPlace } from "@/domain/manager-lineup";

import { STADIUM_SPOTS, stadiumSpots } from "./stadium-spots";

const zoneOf = (spot: { x: number; y: number } | null) => {
  if (!spot) return "outside";
  if (spot.y < 100) return "top-bend";
  if (spot.y > 400) return "bottom-bend";
  if (spot.x > 250) return "home-straight";
  if (spot.x < 50) return "back-straight";
  return "field";
};

describe("stadium spots", () => {
  it("puts each family at its place in the stadium", () => {
    const places: LineupPlace[] = ["sprint", "middle", "long", "jumps", "throws", "free"];
    expect(stadiumSpots(places).map(zoneOf)).toEqual([
      "home-straight",
      "top-bend",
      "bottom-bend",
      "field",
      "field",
      "back-straight",
    ]);
  });

  it("draws jumps on the runway, throws in the circles and combined events in between", () => {
    const [jumps, throws, combined] = stadiumSpots(["jumps", "throws", "combined"]);
    expect(jumps!.x).toBeLessThan(combined!.x);
    expect(combined!.x).toBeLessThan(throws!.x);
  });

  it("never gives two places the same spot, even when a family overflows its zone", () => {
    const places: LineupPlace[] = Array.from({ length: STADIUM_SPOTS }, () => "sprint");
    const spots = stadiumSpots(places);
    expect(spots.every((s) => s !== null)).toBe(true);
    expect(new Set(spots.map((s) => `${s!.x},${s!.y}`)).size).toBe(STADIUM_SPOTS);
  });

  it("leaves the places beyond the stadium outside it", () => {
    const places: LineupPlace[] = Array.from({ length: STADIUM_SPOTS + 2 }, () => "free");
    expect(stadiumSpots(places).filter((s) => s === null)).toHaveLength(2);
  });

  it("keeps spots far enough apart for their cards not to overlap", () => {
    const places: LineupPlace[] = Array.from({ length: STADIUM_SPOTS }, () => "free");
    const spots = stadiumSpots(places).filter((s) => s !== null);
    for (const a of spots)
      for (const b of spots)
        if (a !== b) expect(Math.abs(a.x - b.x) >= 58 || Math.abs(a.y - b.y) >= 62).toBe(true);
  });
});
