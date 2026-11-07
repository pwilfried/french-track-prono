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
