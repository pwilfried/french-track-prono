import { describe, expect, it } from "vitest";

import { HARE_PARTS, hareSvg } from "./hare-art";

describe("hare drawing", () => {
  it("draws the head alone without the body for the favicon", () => {
    const full = hareSvg("full");
    const head = hareSvg("head");
    const body = HARE_PARTS.filter((part) => !part.head);

    expect(body.length).toBeGreaterThan(0);
    for (const part of body) {
      expect(full).toContain(part.d);
      expect(head).not.toContain(part.d);
    }
  });

  it("wears the red headband with a navy outline", () => {
    const svg = hareSvg("head");

    expect(svg).toContain('fill="#E03020"');
    expect(svg).toContain('stroke="#052B5C"');
  });
});
