import { messages } from "@/app/messages.fr";
import type { Animal as AnimalName } from "@/domain/band";
import { cn } from "@/lib/utils";

import { ANIMAL_DRAWINGS } from "./animal-drawings";

/** An animal of the band, or the grey « ? » of what is still to win. */
export type AnimalKind = AnimalName | "locked";

const SIZES = { small: "size-10", medium: "size-16", large: "size-28" } as const;

/**
 * An animal of the band in its medallion (#768): the profile header, the badges, the band and the
 * statuettes all use this one component. `label` names it for screen readers; without it, the
 * animal is decorative (its name sits next to it).
 */
export function Animal({
  kind,
  size = "small",
  label = false,
  className = "",
}: {
  kind: AnimalKind;
  size?: keyof typeof SIZES;
  label?: boolean;
  className?: string;
}) {
  const a11y = label
    ? {
        role: "img",
        "aria-label": kind === "locked" ? messages.band.locked : messages.band.animals[kind],
      }
    : { "aria-hidden": true as const };
  return (
    <svg
      viewBox="0 0 64 64"
      data-animal={kind}
      className={cn("shrink-0", SIZES[size], className)}
      {...a11y}
    >
      {kind === "locked" ? (
        <>
          <circle cx={32} cy={32} r={31} fill="#D5DAE1" />
          <circle
            cx={32}
            cy={32}
            r={27}
            fill="none"
            stroke="#9AA4B2"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          <text
            x={32}
            y={43}
            textAnchor="middle"
            fontSize={32}
            fontWeight={800}
            fill="#5B6574"
            fontFamily="var(--font-display, sans-serif)"
          >
            ?
          </text>
        </>
      ) : (
        <>
          <circle cx={32} cy={32} r={31} fill={ANIMAL_DRAWINGS[kind].disc} />
          <g>{ANIMAL_DRAWINGS[kind].head}</g>
        </>
      )}
    </svg>
  );
}
