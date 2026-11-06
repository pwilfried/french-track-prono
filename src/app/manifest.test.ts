import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "./manifest";
import { messages } from "./messages.fr";

describe("web app manifest", () => {
  it("uses the app name and opens on the home page as a standalone app", () => {
    const m = manifest();

    expect(m.name).toBe(messages.app.name);
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.lang).toBe("fr");
  });

  it("uses the brand colors", () => {
    const m = manifest();

    expect(m.theme_color).toBe("#084595");
    expect(m.background_color).toBe("#052b5c");
  });

  it("declares icons that exist, including a maskable one", () => {
    const icons = manifest().icons ?? [];

    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of icons) {
      expect(existsSync(join(process.cwd(), "public", icon.src))).toBe(true);
    }
  });
});
