import { describe, expect, it } from "vitest";

import { lineupPlaces, type LineupPlace } from "@/domain/manager-lineup";

import { CARD_WIDTH, STADIUM_RATIO, STADIUM_SPOTS, stadiumSpots } from "./stadium-spots";

/** The narrowest stadium (a 320 px screen less its margins) and the height of a card. */
const NARROWEST = 288;
const CARD_HEIGHT = 46;
/** The stadium on a 375 px and a 390 px screen, less their margins. */
const WIDTHS = [NARROWEST, 343, 358];
/** The outer edge of the track, in percent of the stadium (`StadiumDrawing`): rx 47, ry 50. */
const insideOval = (x: number, y: number) => ((x - 50) / 47) ** 2 + ((y - 50) / 50) ** 2 <= 1;

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
  it("puts races on the track and field events on the grass, two places per family", () => {
    expect(stadiumSpots(lineupPlaces({ perFamily: 2 })).map(where)).toEqual([
      "bottom-straight",
      "left-bend",
      "right-bend",
      "back-straight",
      "field-top",
      "field-left",
      "field-right",
      "field-centre",
    ]);
  });

  it("never gives two places the same spot, even when a family overflows its zone", () => {
    const places: LineupPlace[] = Array.from({ length: STADIUM_SPOTS }, () => "sprint");
    const spots = stadiumSpots(places);
    expect(spots.every((s) => s !== null)).toBe(true);
    expect(new Set(spots.map((s) => `${s!.x},${s!.y}`)).size).toBe(STADIUM_SPOTS);
  });

  it("leaves the places beyond the stadium outside it", () => {
    const places: LineupPlace[] = Array.from({ length: STADIUM_SPOTS + 2 }, () => "jumps");
    expect(stadiumSpots(places).filter((s) => s === null)).toHaveLength(2);
  });

  it("keeps cards apart on a 320 px screen, inside the stadium's width", () => {
    const height = (CARD_HEIGHT / (NARROWEST * STADIUM_RATIO)) * 100;
    const spots = stadiumSpots(lineupPlaces({ perFamily: 2 })).filter((s) => s !== null);
    for (const a of spots) {
      expect(a.x - CARD_WIDTH / 2).toBeGreaterThanOrEqual(0);
      expect(a.x + CARD_WIDTH / 2).toBeLessThanOrEqual(100);
      for (const b of spots)
        if (a !== b)
          expect(Math.abs(a.x - b.x) >= CARD_WIDTH || Math.abs(a.y - b.y) >= height).toBe(true);
    }
  });

  it.each(WIDTHS)("keeps every card inside the oval on a %i px wide stadium", (width) => {
    const half = ((CARD_HEIGHT / (width * STADIUM_RATIO)) * 100) / 2;
    for (const s of stadiumSpots(lineupPlaces({ perFamily: 2 })).filter((s) => s !== null)) {
      const corners = [-1, 1].flatMap((dx) =>
        [-1, 1].map((dy) => [s.x + (dx * CARD_WIDTH) / 2, s.y + dy * half] as const),
      );
      for (const [x, y] of corners) expect(insideOval(x, y), `${s.x},${s.y}`).toBe(true);
    }
  });
});
