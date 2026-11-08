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
    expect(m.scope).toBe("/");
    expect(m.orientation).toBe("portrait");
  });

  it("uses the cream page colour of the Officiel design", () => {
    const m = manifest();

    expect(m.theme_color).toBe("#fdfbf5");
    expect(m.background_color).toBe("#fdfbf5");
  });

  it("declares icons that exist, including a maskable one", () => {
    const icons = manifest().icons ?? [];

    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of icons) {
      expect(existsSync(join(process.cwd(), "public", icon.src))).toBe(true);
    }
  });
});
