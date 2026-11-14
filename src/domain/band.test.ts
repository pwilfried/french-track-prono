import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  ANIMALS,
  animalChange,
  animalOf,
  animalToReach,
  bandPoints,
  playerAnimal,
  type BandLine,
} from "./band";
import { DISCIPLINE_FAMILIES } from "./discipline";

const line = (family: BandLine["family"], points: number, day: number): BandLine => ({
  family,
  points,
  eventStartsAt: `2026-08-${String(day).padStart(2, "0")}T19:00:00Z`,
});

describe("animalOf", () => {
  it("gives each family of events its animal of the band", () => {
    expect(animalOf("sprint")).toBe("guepard");
    expect(animalOf("hurdles")).toBe("impala");
    expect(animalOf("middle")).toBe("lievre");
    expect(animalOf("long")).toBe("lievre");
    expect(animalOf("horizontal_jumps")).toBe("kangourou");
    expect(animalOf("vertical_jumps")).toBe("chat");
    expect(animalOf("throws")).toBe("ours");
    expect(animalOf("combined")).toBe("renard");
  });

  it("leaves relays out of the band", () => {
    expect(animalOf("relay")).toBeNull();
  });

  it("covers the seven animals with the families of events", () => {
    const covered = new Set(DISCIPLINE_FAMILIES.map(animalOf).filter(Boolean));
    expect([...covered].sort()).toEqual([...ANIMALS].sort());
  });
});

describe("bandPoints", () => {
  it("adds up the points of the season per animal, in the order of the band", () => {
    const band = bandPoints([
      line("sprint", 10, 1),
      line("middle", 4, 2),
      line("long", 6, 3),
      line("throws", 0, 4),
      line(null, 9, 5),
      line("relay", 7, 6),
    ]);
    expect(band.map((b) => [b.animal, b.points])).toEqual([
      ["guepard", 10],
      ["impala", 0],
      ["lievre", 10],
      ["kangourou", 0],
      ["chat", 0],
      ["ours", 0],
      ["renard", 0],
    ]);
  });
});

describe("playerAnimal", () => {
  it("is the animal of the family where the player scored the most points", () => {
    expect(playerAnimal([line("sprint", 10, 1), line("throws", 12, 2)])).toBe("ours");
  });

  it("is null before the first point in a family of the band", () => {
    expect(playerAnimal([])).toBeNull();
    expect(playerAnimal([line("sprint", 0, 1), line("relay", 8, 2), line(null, 5, 3)])).toBeNull();
  });

  it("breaks a tie with the most recent points", () => {
    expect(playerAnimal([line("throws", 10, 3), line("sprint", 10, 1)])).toBe("ours");
    expect(playerAnimal([line("throws", 10, 1), line("sprint", 4, 2), line("sprint", 6, 4)])).toBe(
      "guepard",
    );
  });

  it("does not depend on the order the lines come in", () => {
    const families = DISCIPLINE_FAMILIES;
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.constantFrom(...families),
            fc.integer({ min: 0, max: 28 }),
            fc.integer({ min: 1, max: 28 }),
          ),
          { maxLength: 20 },
        ),
        (raw) => {
          const lines = raw.map(([f, p, d]) => line(f, p, d));
          expect(playerAnimal([...lines].reverse())).toBe(playerAnimal(lines));
        },
      ),
    );
  });
});

describe("animalToReach", () => {
  it("names the runner-up and the points it lacks to take over", () => {
    expect(animalToReach([line("sprint", 30, 1), line("throws", 18, 2)])).toEqual({
      animal: "ours",
      points: 12,
    });
  });

  it("asks one point when the runner-up is level, as the most recent points win", () => {
    expect(animalToReach([line("sprint", 10, 3), line("throws", 10, 1)])).toEqual({
      animal: "ours",
      points: 1,
    });
  });

  it("is null without an animal or without a runner-up", () => {
    expect(animalToReach([])).toBeNull();
    expect(animalToReach([line("sprint", 10, 1)])).toBeNull();
  });
});

describe("animalChange", () => {
  it("shows a new animal once, then stays quiet", () => {
    expect(animalChange(null, "guepard")).toEqual({ animal: "guepard", first: true });
    expect(animalChange("ours", "guepard")).toEqual({ animal: "guepard", first: false });
    expect(animalChange("guepard", "guepard")).toBeNull();
  });

  it("stays quiet before the first animal", () => {
    expect(animalChange(null, null)).toBeNull();
    expect(animalChange("ours", null)).toBeNull();
  });
});
