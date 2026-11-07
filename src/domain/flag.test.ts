import { describe, expect, it } from "vitest";

import { flagOf } from "./flag";

describe("flagOf", () => {
  it("turns an IOC code into its flag, also when it differs from ISO", () => {
    expect(flagOf("FRA")).toBe("🇫🇷");
    expect(flagOf("GER")).toBe("🇩🇪");
    expect(flagOf("NED")).toBe("🇳🇱");
    expect(flagOf("SUI")).toBe("🇨🇭");
    expect(flagOf("lca")).toBe("🇱🇨");
  });

  it("gives null for an unknown code", () => {
    expect(flagOf("XYZ")).toBeNull();
  });
});
