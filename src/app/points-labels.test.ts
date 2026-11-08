import { describe, expect, it } from "vitest";

import { pointsReasonLabels } from "./points-labels";

const texts = (...args: Parameters<typeof pointsReasonLabels>) =>
  pointsReasonLabels(...args).map((label) => label.text);

describe("pointsReasonLabels", () => {
  it("shows a perfect podium as one label, with the joker", () => {
    expect(
      texts([
        { kind: "exact", slot: 1 },
        { kind: "exact", slot: 2 },
        { kind: "exact", slot: 3 },
        { kind: "perfect_podium" },
        { kind: "joker" },
      ]),
    ).toEqual(["Podium parfait", "Joker ×2"]);
  });

  it("sums the points won with the odds and with the marks", () => {
    expect(
      texts([
        { kind: "exact", slot: 1 },
        { kind: "odds", slot: 1, odds: 2, multiplier: 3, points: 6 },
        { kind: "odds", slot: 3, odds: 1.8, multiplier: 1, points: 2 },
        { kind: "mark", slot: 1, predicted: 10.81, official: 10.79, points: 5 },
      ]),
    ).toEqual(["Vainqueur trouvé", "Cotes +8", "Perf juste +5"]);
  });

  it("lists the athletes found, counts the misplaced ones and the flair", () => {
    expect(
      texts([
        { kind: "exact", slot: 1 },
        { kind: "on_podium", slot: 2 },
        { kind: "on_podium", slot: 3 },
        { kind: "flair" },
      ]),
    ).toEqual(["Vainqueur trouvé", "2 athlètes mal placés", "Coup de flair"]);
  });

  it("explains zero points", () => {
    expect(texts([])).toEqual(["Aucun athlète sur le podium"]);
  });

  it("marks the joker label", () => {
    expect(pointsReasonLabels([{ kind: "joker" }]).at(-1)).toEqual({
      text: "Joker ×2",
      joker: true,
    });
  });
});
