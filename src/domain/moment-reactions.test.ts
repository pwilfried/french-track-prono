import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  isMomentEmoji,
  isPresetMessage,
  MOMENT_EMOJIS,
  momentReactions,
  PRESET_MESSAGES,
  type MomentResponse,
} from "./moment-reactions";

const response = (over: Partial<MomentResponse>): MomentResponse => ({
  id: "r1",
  momentKey: "m1",
  kind: "emoji",
  code: "fire",
  pseudo: "Ana",
  mine: false,
  reported: false,
  ...over,
});

describe("moment reactions: the fixed lists", () => {
  it("knows the four emojis and the five preset messages, nothing else", () => {
    expect(MOMENT_EMOJIS).toEqual(["fire", "clap", "wow", "laugh"]);
    expect(PRESET_MESSAGES).toEqual([
      "well_played",
      "what_flair",
      "rematch",
      "bad_luck",
      "catching_up",
    ]);
    expect(isMomentEmoji("fire")).toBe(true);
    expect(isMomentEmoji("🔥")).toBe(false);
    expect(isPresetMessage("rematch")).toBe(true);
    expect(isPresetMessage("hello")).toBe(false);
  });
});

describe("moment reactions: what a moment shows", () => {
  it("shows every emoji with its count and whether I gave it, in the fixed order", () => {
    const shown = momentReactions([
      response({ id: "a", code: "laugh" }),
      response({ id: "b", code: "fire", mine: true }),
      response({ id: "c", code: "fire" }),
    ]);
    expect(shown.m1.emojis).toEqual([
      { code: "fire", count: 2, mine: true },
      { code: "clap", count: 0, mine: false },
      { code: "wow", count: 0, mine: false },
      { code: "laugh", count: 1, mine: false },
    ]);
  });

  it("lists the preset messages under the moment, oldest first, with the pseudo", () => {
    const shown = momentReactions([
      response({ id: "a", kind: "message", code: "rematch", pseudo: "Bob" }),
      response({ id: "b", kind: "message", code: "well_played", pseudo: "Ana", mine: true }),
    ]);
    expect(shown.m1.messages).toEqual([
      { id: "a", code: "rematch", pseudo: "Bob", mine: false, reported: false },
      { id: "b", code: "well_played", pseudo: "Ana", mine: true, reported: false },
    ]);
    expect(shown.m1.myMessage).toBe("well_played");
  });

  it("keeps each moment apart, and leaves out codes out of the lists", () => {
    const shown = momentReactions([
      response({ id: "a", momentKey: "m1", code: "fire" }),
      response({ id: "b", momentKey: "m2", code: "clown" }),
      response({ id: "c", momentKey: "m2", kind: "message", code: "hello" }),
    ]);
    expect(shown.m1.emojis[0].count).toBe(1);
    expect(shown.m2.emojis.every((e) => e.count === 0)).toBe(true);
    expect(shown.m2.messages).toEqual([]);
    expect(shown.m2.myMessage).toBeNull();
  });

  it("counts the same whatever the order the reactions come in", () => {
    const arbitrary = fc.array(
      fc.record({
        id: fc.uuid(),
        momentKey: fc.constantFrom("m1", "m2"),
        code: fc.constantFrom(...MOMENT_EMOJIS),
        mine: fc.boolean(),
      }),
    );
    fc.assert(
      fc.property(arbitrary, (items) => {
        const responses = items.map((i) => response(i));
        const counts = (r: MomentResponse[]) =>
          Object.fromEntries(Object.entries(momentReactions(r)).map(([k, v]) => [k, v.emojis]));
        expect(counts([...responses].reverse())).toEqual(counts(responses));
      }),
    );
  });
});
