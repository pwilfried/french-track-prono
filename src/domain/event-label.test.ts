import { describe, expect, it } from "vitest";

import { eventLabel } from "./event-label";

describe("eventLabel", () => {
  it("appends the gender to a discipline that does not carry it", () => {
    expect(eventLabel("100 m", "Femmes")).toBe("100 m femmes");
    expect(eventLabel("Saut en hauteur", "Hommes")).toBe("Saut en hauteur hommes");
  });

  it("does not repeat « mixte » when the discipline already says it", () => {
    expect(eventLabel("Relais mixte 4x100 m", "Mixte")).toBe("Relais mixte 4x100 m");
    expect(eventLabel("Relais Mixte 4x400 m", "Mixte")).toBe("Relais Mixte 4x400 m");
  });

  it("does not repeat « femmes » or « hommes » when the discipline already says it", () => {
    expect(eventLabel("4x100 m femmes", "Femmes")).toBe("4x100 m femmes");
    expect(eventLabel("Décathlon hommes", "Hommes")).toBe("Décathlon hommes");
  });
});
