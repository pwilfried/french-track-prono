import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { worldAthleticsPoints } from "./world-athletics-points";
import { WORLD_ATHLETICS_EDITION } from "./world-athletics-tables";

// Reference values of the World Athletics scoring tables, 2025 edition (#428).
describe("worldAthleticsPoints", () => {
  it("reads the 2025 edition of the tables", () => {
    expect(WORLD_ATHLETICS_EDITION).toBe("2025");
  });

  it.each([
    ["100 m", "M", 9.58, 1356],
    ["100 m", "M", 10.0, 1206],
    ["100 m", "F", 10.49, 1314],
    ["200 m", "M", 19.19, 1351],
    ["400 m", "F", 47.6, 1304],
    ["110 m haies", "M", 12.8, 1294],
    ["100 m haies", "F", 12.12, 1272],
    ["400 m haies", "F", 50.37, 1322],
    ["800 m", "M", 100.91, 1301],
    ["1500 m", "F", 229.11, 1295],
    ["5000 m", "M", 755.36, 1302],
    ["10 000 m", "F", 1736.18, 1307],
    ["3000 m steeple", "M", 472.11, 1295],
    ["Marathon", "M", 7235, 1307],
    ["Relais 4x100 m", "M", 36.84, 1318],
    ["Relais mixte 4x400 m", "M", 187.41, 1234],
  ] as const)("scores a race: %s %s in %ss is worth %i points", (discipline, sex, mark, points) => {
    expect(worldAthleticsPoints(discipline, sex, mark)).toBe(points);
  });

  it.each([
    ["Saut en hauteur", "F", 2.09, 1309],
    ["Saut en hauteur", "M", 2.0, 914],
    ["Saut à la perche", "M", 6.26, 1339],
    ["Saut en longueur", "M", 8.95, 1346],
    ["Triple saut", "F", 15.74, 1297],
  ] as const)("scores a jump: %s %s at %sm is worth %i points", (discipline, sex, mark, points) => {
    expect(worldAthleticsPoints(discipline, sex, mark)).toBe(points);
  });

  it.each([
    ["Lancer du poids", "M", 23.56, 1334],
    ["Lancer du disque", "F", 76.8, 1382],
    ["Lancer du marteau", "M", 86.74, 1307],
    ["Javelot", "F", 72.28, 1306],
  ] as const)(
    "scores a throw: %s %s at %sm is worth %i points",
    (discipline, sex, mark, points) => {
      expect(worldAthleticsPoints(discipline, sex, mark)).toBe(points);
    },
  );

  it.each([
    ["Décathlon", "M", 9126, 1302],
    ["Décathlon", "M", 8000, 1126],
    ["Heptathlon", "F", 7291, 1331],
  ] as const)(
    "converts the official total of a combined event: %s %s with %i is worth %i points",
    (discipline, sex, mark, points) => {
      expect(worldAthleticsPoints(discipline, sex, mark)).toBe(points);
    },
  );

  it("gives 0 points to a race slower than the zero of the table", () => {
    expect(worldAthleticsPoints("100 m", "M", 17.5)).toBe(0);
  });

  it("gives 0 points to a jump or a throw below the zero of the table", () => {
    expect(worldAthleticsPoints("Saut en hauteur", "F", 0.5)).toBe(0);
  });

  it("gives 0 points to a mark that is not a positive number", () => {
    expect(worldAthleticsPoints("100 m", "M", 0)).toBe(0);
    expect(worldAthleticsPoints("Saut en longueur", "F", -6)).toBe(0);
    expect(worldAthleticsPoints("800 m", "F", Number.NaN)).toBe(0);
  });

  it("has no table for a discipline or a sex the tables do not cover", () => {
    expect(worldAthleticsPoints("Relais mixte 4x100 m", "F", 40.5)).toBeNull();
    expect(worldAthleticsPoints("Décathlon", "F", 7000)).toBeNull();
    expect(worldAthleticsPoints("110 m haies", "F", 13)).toBeNull();
    expect(worldAthleticsPoints("Lancer de la brique", "M", 30)).toBeNull();
  });

  const SCORED = [
    "100 m",
    "200 m",
    "400 m",
    "400 m haies",
    "800 m",
    "1500 m",
    "3000 m steeple",
    "5000 m",
    "10 000 m",
    "Marathon",
    "Saut en longueur",
    "Triple saut",
    "Saut en hauteur",
    "Saut à la perche",
    "Lancer du poids",
    "Lancer du disque",
    "Lancer du marteau",
    "Javelot",
    "Heptathlon",
    "Relais 4x100 m",
    "Relais 4x400 m",
    "Relais mixte 4x400 m",
  ];

  it("has a table for both sexes in every individual discipline they share", () => {
    for (const discipline of SCORED) {
      for (const sex of ["F", "M"] as const) {
        expect(worldAthleticsPoints(discipline, sex, 1), `${discipline} ${sex}`).not.toBeNull();
      }
    }
  });

  // Jumps, throws and combined events: a higher mark is better. Races: a lower one.
  const HIGHER_IS_BETTER = new Set([
    "Saut en longueur",
    "Triple saut",
    "Saut en hauteur",
    "Saut à la perche",
    "Lancer du poids",
    "Lancer du disque",
    "Lancer du marteau",
    "Javelot",
    "Heptathlon",
  ]);
  const scored = fc.record({
    discipline: fc.constantFrom(...SCORED),
    sex: fc.constantFrom("F" as const, "M" as const),
    a: fc.double({ min: 0.01, max: 10_000, noNaN: true }),
    b: fc.double({ min: 0.01, max: 10_000, noNaN: true }),
  });

  it("always gives a whole number of points, never negative", () => {
    fc.assert(
      fc.property(scored, ({ discipline, sex, a }) => {
        const points = worldAthleticsPoints(discipline, sex, a)!;
        return Number.isInteger(points) && points >= 0;
      }),
    );
  });

  it("never gives fewer points to a better mark", () => {
    fc.assert(
      fc.property(scored, ({ discipline, sex, a, b }) => {
        const [low, high] = [Math.min(a, b), Math.max(a, b)];
        const [worse, better] = HIGHER_IS_BETTER.has(discipline) ? [low, high] : [high, low];
        return (
          worldAthleticsPoints(discipline, sex, better)! >=
          worldAthleticsPoints(discipline, sex, worse)!
        );
      }),
    );
  });
});
