import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("web app manifest", () => {
  it("uses the app name and opens on the home page as a standalone app", () => {
    const m = manifest();

    expect(m.name).toBe("French Track Prono");
    expect(m.short_name).toBe("FrenchTrack");
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

  it("ships the hare's head as the browser tab favicon", () => {
    for (const file of ["favicon.ico", "icons/favicon-32.png", "icons/favicon-16.png"]) {
      expect(existsSync(join(process.cwd(), "public", file))).toBe(true);
    }
  });
});
