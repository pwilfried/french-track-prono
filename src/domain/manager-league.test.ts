import { describe, expect, it } from "vitest";

import { canStartManagerSeason } from "./manager-league";

describe("canStartManagerSeason", () => {
  it.each([4, 6, 10, 12])("starts with %i participants", (n) => {
    expect(canStartManagerSeason(n)).toBe(true);
  });

  it.each([1, 2, 5, 11, 13, 14])("does not start with %i participants", (n) => {
    expect(canStartManagerSeason(n)).toBe(false);
  });
});
