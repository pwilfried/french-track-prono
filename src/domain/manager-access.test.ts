import { describe, expect, it } from "vitest";

import { seesManager } from "./manager-access";

describe("seesManager", () => {
  it("shows the Manager to an admin", () => {
    expect(seesManager({ isAdmin: true })).toBe(true);
  });

  it("hides the Manager from a player who is not an admin", () => {
    expect(seesManager({ isAdmin: false })).toBe(false);
  });
});
