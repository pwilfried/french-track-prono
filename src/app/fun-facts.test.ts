import { describe, expect, it } from "vitest";

import { gameFunFacts } from "./fun-facts";

describe("the facts about the game", () => {
  it("quotes the points of the admin's scale, not typed figures", () => {
    const facts = gameFunFacts({ exact_slot: 5, perfect_podium: 10, joker_multiplier: 3 });
    const perfect = facts.find((f) => f.id === "game-perfect-podium")!;
    const joker = facts.find((f) => f.id === "game-joker")!;
    expect(perfect.body).toContain("25 points");
    expect(joker.body).toContain("par 3");
    expect(joker.body).toContain("75 points");
  });

  it("tags them « Pour tes pronos » and ties them to no day", () => {
    for (const fact of gameFunFacts({})) {
      expect(fact).toMatchObject({ tag: "predictions", competitionSlug: null, startsOn: null });
    }
  });
});
