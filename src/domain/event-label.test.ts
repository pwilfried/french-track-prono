import { describe, expect, it } from "vitest";

import { eventLabel, keepUnits } from "./event-label";

const NBSP = "\u00a0";

describe("keepUnits", () => {
  it("joins a number to its unit with a no-break space", () => {
    expect(keepUnits("Relais 4x100 m")).toBe(`Relais 4x100${NBSP}m`);
    expect(keepUnits("10000 m marche")).toBe(`10000${NBSP}m marche`);
    expect(keepUnits("12 pts, 3 km, 7 kg, 9 s")).toBe(
      `12${NBSP}pts, 3${NBSP}km, 7${NBSP}kg, 9${NBSP}s`,
    );
  });

  it("leaves a number followed by a word alone", () => {
    expect(keepUnits("3 marcheurs")).toBe("3 marcheurs");
    expect(keepUnits("Saut en hauteur")).toBe("Saut en hauteur");
  });
});

describe("eventLabel", () => {
  it("never cuts a distance from its unit", () => {
    expect(eventLabel("4x100 m", "Femmes")).toBe(`4x100${NBSP}m femmes`);
  });

  it("appends the gender to a discipline that does not carry it", () => {
    expect(eventLabel("100 m", "Femmes")).toBe(`100${NBSP}m femmes`);
    expect(eventLabel("Saut en hauteur", "Hommes")).toBe("Saut en hauteur hommes");
  });

  it("does not repeat « mixte » when the discipline already says it", () => {
    expect(eventLabel("Relais mixte 4x100 m", "Mixte")).toBe(`Relais mixte 4x100${NBSP}m`);
    expect(eventLabel("Relais Mixte 4x400 m", "Mixte")).toBe(`Relais Mixte 4x400${NBSP}m`);
  });

  it("does not repeat « femmes » or « hommes » when the discipline already says it", () => {
    expect(eventLabel("4x100 m femmes", "Femmes")).toBe(`4x100${NBSP}m femmes`);
    expect(eventLabel("Décathlon hommes", "Hommes")).toBe("Décathlon hommes");
  });
});
