import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  emptyDraft,
  isComplete,
  placeAthlete,
  removeStep,
  swapSteps,
  toPodium,
  type PodiumDraft,
  type Step,
} from "./podium-draft";

const draft = (first: string | null, second: string | null, third: string | null): PodiumDraft => ({
  first,
  second,
  third,
});

describe("placeAthlete", () => {
  it("puts an athlete on an empty step", () => {
    expect(placeAthlete(emptyDraft(), 1, "a")).toEqual(draft("a", null, null));
  });

  it("moves an athlete who is already on another step", () => {
    expect(placeAthlete(draft("a", null, null), 3, "a")).toEqual(draft(null, null, "a"));
  });

  it("replaces whoever was on the step when the new athlete comes from outside", () => {
    expect(placeAthlete(draft("a", "b", null), 1, "c")).toEqual(draft("c", "b", null));
  });

  it("swaps the two athletes when the new one comes from another step and the target is taken", () => {
    expect(placeAthlete(draft("a", "b", null), 1, "b")).toEqual(draft("b", "a", null));
  });

  it("changes nothing when the athlete is placed where he already is", () => {
    const current = draft("a", "b", "c");
    expect(placeAthlete(current, 2, "b")).toEqual(current);
  });

  it("does not change the draft it was given", () => {
    const current = draft("a", null, null);
    placeAthlete(current, 2, "b");
    expect(current).toEqual(draft("a", null, null));
  });
});

describe("removeStep", () => {
  it("empties a step", () => {
    expect(removeStep(draft("a", "b", "c"), 2)).toEqual(draft("a", null, "c"));
  });
});

describe("swapSteps", () => {
  it("swaps two steps, empty or not", () => {
    expect(swapSteps(draft("a", "b", null), 1, 3)).toEqual(draft(null, "b", "a"));
  });
});

describe("isComplete and toPodium", () => {
  it("is not complete with a step missing, and gives no podium", () => {
    const partial = draft("a", null, "c");
    expect(isComplete(partial)).toBe(false);
    expect(toPodium(partial)).toBeNull();
  });

  it("is complete with three athletes and gives them in order", () => {
    const full = draft("a", "b", "c");
    expect(isComplete(full)).toBe(true);
    expect(toPodium(full)).toEqual({ first: "a", second: "b", third: "c" });
  });
});

describe("any sequence of actions", () => {
  const step = fc.constantFrom<Step>(1, 2, 3);
  const action = fc.oneof(
    fc.record({
      kind: fc.constant("place" as const),
      step,
      athlete: fc.constantFrom("a", "b", "c", "d"),
    }),
    fc.record({ kind: fc.constant("remove" as const), step }),
    fc.record({ kind: fc.constant("swap" as const), a: step, b: step }),
  );

  it("never puts the same athlete on two steps, and a complete draft is always a valid podium", () => {
    fc.assert(
      fc.property(fc.array(action, { maxLength: 30 }), (actions) => {
        let current = emptyDraft();
        for (const a of actions) {
          current =
            a.kind === "place"
              ? placeAthlete(current, a.step, a.athlete)
              : a.kind === "remove"
                ? removeStep(current, a.step)
                : swapSteps(current, a.a, a.b);
          const placed = [current.first, current.second, current.third].filter((x) => x !== null);
          expect(new Set(placed).size).toBe(placed.length);
        }
        const podium = toPodium(current);
        if (podium) expect(new Set([podium.first, podium.second, podium.third]).size).toBe(3);
      }),
    );
  });
});
