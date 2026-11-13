import { describe, expect, it } from "vitest";

import { currentSeasonStep, SEASON_STEPS, seasonSteps, type SeasonProgress } from "./manager-home";

const closed: SeasonProgress = {
  league: true,
  mercato: "closed",
  nextLineup: null,
  scored: false,
  over: false,
};

describe("currentSeasonStep", () => {
  it("is the league while the player has no Manager league", () => {
    expect(currentSeasonStep({ league: false })).toBe("league");
  });

  it("stays on the league while its mercato waits for its players", () => {
    expect(currentSeasonStep({ ...closed, mercato: "waiting" })).toBe("league");
  });

  it("is the mercato while it is open", () => {
    expect(currentSeasonStep({ ...closed, mercato: "open" })).toBe("mercato");
  });

  it("is the team once the mercato is closed and no lineup is open yet", () => {
    expect(currentSeasonStep(closed)).toBe("team");
  });

  it("is the lineup while the next competition waits for one", () => {
    expect(currentSeasonStep({ ...closed, nextLineup: "todo" })).toBe("lineup");
  });

  it("is the points once the lineup is validated or locked, until the competition is scored", () => {
    expect(currentSeasonStep({ ...closed, nextLineup: "validated" })).toBe("points");
    expect(currentSeasonStep({ ...closed, nextLineup: "locked", scored: true })).toBe("points");
  });

  it("is the head-to-heads once a matchday is scored and no lineup is open", () => {
    expect(currentSeasonStep({ ...closed, scored: true })).toBe("duels");
  });

  it("is the champion once the season is over, whatever the lineups", () => {
    expect(currentSeasonStep({ ...closed, scored: true, nextLineup: "todo", over: true })).toBe(
      "champion",
    );
  });
});

describe("seasonSteps", () => {
  it("ticks the steps before the current one and leaves the next ones to do", () => {
    expect(seasonSteps("lineup")).toEqual([
      { step: "league", state: "done" },
      { step: "mercato", state: "done" },
      { step: "team", state: "done" },
      { step: "lineup", state: "current" },
      { step: "points", state: "todo" },
      { step: "duels", state: "todo" },
      { step: "champion", state: "todo" },
    ]);
  });

  it("lists the seven steps of the season in order", () => {
    expect(seasonSteps("league").map((s) => s.step)).toEqual(SEASON_STEPS);
    expect(SEASON_STEPS).toHaveLength(7);
  });
});
