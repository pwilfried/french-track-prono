import { describe, expect, it } from "vitest";

import { leagueOffer } from "./prediction-league-offer";

const a = { id: "a", counted: false };
const b = { id: "b", counted: false };
const c = { id: "c", counted: false };

describe("leagueOffer", () => {
  it("asks to tick among several leagues outside a league", () => {
    expect(leagueOffer([a, b])).toEqual({ origin: undefined, offered: ["a", "b"], mode: "list" });
  });

  it("asks a plain question for a single league outside a league", () => {
    expect(leagueOffer([a])).toEqual({ origin: undefined, offered: ["a"], mode: "one" });
  });

  it("does not ask again when the prediction already counts in a league", () => {
    expect(leagueOffer([{ ...a, counted: true }, b]).mode).toBe("none");
  });

  it("counts in the league it comes from and offers the others", () => {
    expect(leagueOffer([a, b, c], "a")).toEqual({ origin: "a", offered: ["b", "c"], mode: "list" });
  });

  it("asks a plain question for the only other league", () => {
    expect(leagueOffer([a, b], "a")).toEqual({ origin: "a", offered: ["b"], mode: "one" });
  });

  it("asks nothing when the league it comes from is the only one", () => {
    expect(leagueOffer([a], "a")).toEqual({ origin: "a", offered: [], mode: "none" });
  });

  it("ignores a requested league that is not one of the player's leagues", () => {
    expect(leagueOffer([a, b], "zzz")).toEqual({
      origin: undefined,
      offered: ["a", "b"],
      mode: "list",
    });
  });
});
