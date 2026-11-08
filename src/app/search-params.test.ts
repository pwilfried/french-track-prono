import { describe, expect, it } from "vitest";

import { paramList, paramText } from "./search-params";

describe("query parameters", () => {
  it("reads a parameter given once or several times as a list", () => {
    expect(paramList(undefined)).toEqual([]);
    expect(paramList("a")).toEqual(["a"]);
    expect(paramList(["a", "b"])).toEqual(["a", "b"]);
  });

  it("reads a parameter given once as text, and ignores a repeated one", () => {
    expect(paramText("a")).toBe("a");
    expect(paramText(["a", "b"])).toBeUndefined();
    expect(paramText(undefined)).toBeUndefined();
  });
});
