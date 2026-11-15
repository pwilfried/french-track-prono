import { describe, expect, it } from "vitest";

import { ANIMALS } from "@/domain/band";

import { SEASON_CARD_PALETTE } from "./season-card-palette";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG 2 contrast ratio of two `#RRGGBB` colours, from 1 to 21. */
function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("SEASON_CARD_PALETTE", () => {
  it("measures the WCAG contrast of two colours", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#084595", "#084595")).toBe(1);
  });

  it.each(ANIMALS)("gives the %s card a text that passes AA on its background", (animal) => {
    const { background, text } = SEASON_CARD_PALETTE[animal];
    expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("writes in FrenchTrack blue on the light cards and in cream on the bear's dark one", () => {
    for (const animal of ANIMALS) {
      expect(SEASON_CARD_PALETTE[animal].text).toBe(animal === "ours" ? "#F3E3C7" : "#084595");
    }
  });
});
