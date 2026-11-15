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

  it("knows every National Olympic Committee, Ghana included", () => {
    expect(flagOf("GHA")).toBe("🇬🇭");
    expect(flagOf("MAR")).toBe("🇲🇦");
    expect(flagOf("PUR")).toBe("🇵🇷");
    expect(flagOf("IND")).toBe("🇮🇳");
    expect(flagOf("RSA")).toBe("🇿🇦");
    expect(flagOf("TPE")).toBe("🇹🇼");
    expect(flagOf("KSA")).toBe("🇸🇦");
    expect(flagOf("BAH")).toBe("🇧🇸");
    expect(flagOf("MAS")).toBe("🇲🇾");
    expect(flagOf("VIN")).toBe("🇻🇨");
    expect(flagOf("ZIM")).toBe("🇿🇼");
    expect(flagOf("KOS")).toBe("🇽🇰");
  });

  it("gives null for an unknown code", () => {
    expect(flagOf("XYZ")).toBeNull();
  });
});
