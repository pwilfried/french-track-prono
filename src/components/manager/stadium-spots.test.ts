import { describe, expect, it } from "vitest";

import type { LineupPlace } from "@/domain/manager-lineup";

import { CARD_WIDTH, STADIUM_RATIO, STADIUM_SPOTS, stadiumSpots } from "./stadium-spots";

/** The narrowest stadium (a 320 px screen less its margins) and the height of a card. */
const NARROWEST = 288;
const CARD_HEIGHT = 46;

const where = (spot: { x: number; y: number } | null) => {
  if (!spot) return "outside";
  if (spot.y > 85) return "bottom-straight";
  if (spot.y < 15) return "back-straight";
  if (spot.x < 20) return "left-bend";
  if (spot.x > 80) return "right-bend";
  if (spot.y < 40) return "field-top";
  if (spot.y > 60) return "field-centre";
  return spot.x < 50 ? "field-left" : "field-right";
};

describe("stadium spots", () => {
  it("puts the places of the default rules where the mock-up draws them", () => {
    const places: LineupPlace[] = ["sprint", "middle", "throws", ...Array(5).fill("free")];
    expect(stadiumSpots(places).map(where)).toEqual([
      "bottom-straight",
      "right-bend",
      "field-right",
      "left-bend",
      "field-top",
      "field-left",
      "field-centre",
      "back-straight",
    ]);
  });

  it("puts races on the track and field events on the grass", () => {
    const places: LineupPlace[] = ["sprint", "sprint", "middle", "jumps", "jumps", "throws"];
    expect(stadiumSpots(places).map(where)).toEqual([
      "bottom-straight",
      "left-bend",
      "right-bend",
      "field-top",
      "field-left",
      "field-right",
    ]);
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

  it("keeps cards apart on a 320 px screen, inside the stadium's width", () => {
    const height = (CARD_HEIGHT / (NARROWEST * STADIUM_RATIO)) * 100;
    const places: LineupPlace[] = Array.from({ length: STADIUM_SPOTS }, () => "free");
    const spots = stadiumSpots(places).filter((s) => s !== null);
    for (const a of spots) {
      expect(a.x - CARD_WIDTH / 2).toBeGreaterThanOrEqual(0);
      expect(a.x + CARD_WIDTH / 2).toBeLessThanOrEqual(100);
      for (const b of spots)
        if (a !== b)
          expect(Math.abs(a.x - b.x) >= CARD_WIDTH || Math.abs(a.y - b.y) >= height).toBe(true);
    }
  });
});
