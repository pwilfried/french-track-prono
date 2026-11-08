import { describe, expect, it } from "vitest";

import { isBackOffice } from "./player-only";

describe("isBackOffice", () => {
  it("is the admin pages only", () => {
    expect(isBackOffice("/admin")).toBe(true);
    expect(isBackOffice("/admin/competitions/x")).toBe(true);
    expect(isBackOffice("/administration-legale")).toBe(false);
    expect(isBackOffice("/epreuves")).toBe(false);
    expect(isBackOffice(null)).toBe(false);
  });
});
