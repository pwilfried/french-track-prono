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
