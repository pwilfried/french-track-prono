import { describe, expect, it } from "vitest";

import { REACTIONS, isReaction, reactionCounts } from "./reveal";

describe("isReaction", () => {
  it("accepts the six reactions of the list", () => {
    for (const reaction of REACTIONS) expect(isReaction(reaction)).toBe(true);
  });

  it.each([["❤️"], ["lol"], [""], ["🔥🔥"]])("refuses %j", (value) => {
    expect(isReaction(value)).toBe(false);
  });
});

describe("reactionCounts", () => {
  it("counts each reaction in the order of the list and leaves out the absent ones", () => {
    expect(reactionCounts(["😂", "🔥", "😂"])).toEqual([
      { reaction: "🔥", count: 1 },
      { reaction: "😂", count: 2 },
    ]);
  });
});
