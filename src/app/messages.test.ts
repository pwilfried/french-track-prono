import { describe, expect, it } from "vitest";

import { splitDuration } from "@/domain/countdown";

import { messages } from "./messages.fr";

const format = (seconds: number) => messages.countdown.duration(splitDuration(seconds));

describe("countdown duration text", () => {
  it.each([
    [2 * 86400 + 4 * 3600, "2 j 4 h"],
    [86400, "1 j"],
    [3 * 3600 + 5 * 60, "3 h 5 min"],
    [3600, "1 h"],
    [42 * 60 + 30, "42 min"],
    [4 * 60 + 12, "4 min 12 s"],
    [5 * 60, "5 min"],
    [38, "38 s"],
  ])("writes %i seconds as %s", (seconds, text) => {
    expect(format(seconds)).toBe(text);
  });
});

describe("incomplete Manager team text", () => {
  const { short, nobody } = messages.team;

  it("says how many athletes the team has and which one was missing", () => {
    expect(short(11, 12, [nobody.F.throws])).toBe(
      "Ton équipe compte 11 athlètes au lieu de 12 : il ne restait plus aucune lanceuse libre à la fin du mercato. Tu joues quand même.",
    );
  });

  it("joins several missing families with « ni »", () => {
    expect(short(1, 3, [nobody.F.sprint, nobody.M.long, nobody.M.throws])).toBe(
      "Ton équipe compte 1 athlète au lieu de 3 : il ne restait plus aucune sprinteuse, aucun fondeur ni aucun lanceur libre à la fin du mercato. Tu joues quand même.",
    );
  });

  it("gives no reason when every quota is reached", () => {
    expect(short(10, 12, [])).toBe(
      "Ton équipe compte 10 athlètes au lieu de 12. Tu joues quand même.",
    );
  });
});
