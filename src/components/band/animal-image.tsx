import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

import type { Animal } from "@/domain/band";

import { ANIMAL_DRAWINGS } from "./animal-drawings";

/** Calls the small components of a drawing (eyes, nose…): the image renderer only knows SVG tags. */
function intrinsic(node: ReactNode): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ children?: ReactNode }>;
    if (typeof el.type === "function") {
      return intrinsic((el.type as (props: object) => ReactNode)(el.props));
    }
    return el.props.children === undefined
      ? el
      : cloneElement(el, undefined, intrinsic(el.props.children));
  });
}

/**
 * An animal of the band in its medallion, for a generated image (the season card, #900): the same
 * drawing as the `Animal` component, sized in pixels and without CSS classes.
 */
export function animalImage(kind: Animal, size: number) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx={32} cy={32} r={31} fill={ANIMAL_DRAWINGS[kind].disc} />
      <g>{intrinsic(ANIMAL_DRAWINGS[kind].head)}</g>
    </svg>
  );
}
