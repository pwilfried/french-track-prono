import { describe, expect, it } from "vitest";

import { appViewport } from "./viewport";

describe("app viewport", () => {
  it("covers the whole screen so fixed bars stay pinned in the iOS home-screen app", () => {
    expect(appViewport.viewportFit).toBe("cover");
  });

  it("keeps the device width and the Officiel theme colours", () => {
    expect(appViewport.width).toBe("device-width");
    expect(appViewport.initialScale).toBe(1);
    expect(appViewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#fdfbf5" },
      { media: "(prefers-color-scheme: dark)", color: "#052b5c" },
    ]);
  });
});
