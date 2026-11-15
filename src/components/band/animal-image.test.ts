import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { ANIMALS } from "@/domain/band";

import { animalImage } from "./animal-image";

/** Every element type under a node: what the image renderer will meet inside the <svg>. */
function typesOf(node: ReactNode): unknown[] {
  if (Array.isArray(node)) return node.flatMap(typesOf);
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<{ children?: ReactNode }>;
  return [el.type, ...typesOf(el.props.children)];
}

describe("animalImage", () => {
  it.each(ANIMALS)("draws the %s with intrinsic SVG elements only", (animal) => {
    const svg = animalImage(animal, 360);
    for (const type of typesOf(svg)) {
      expect(typeof type === "string" || type === Fragment).toBe(true);
    }
  });

  it("draws the medallion at the requested size, on the animal's disc", () => {
    const svg = animalImage("ours", 360) as ReactElement<{ width: number; height: number }>;
    expect(svg.type).toBe("svg");
    expect(svg.props.width).toBe(360);
    expect(svg.props.height).toBe(360);
    expect(typesOf(svg)).toContain("circle");
  });
});
