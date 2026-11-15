import { useId, type ReactNode } from "react";

import type { Animal as AnimalName } from "@/domain/band";
import type { Metal } from "@/domain/trophies";
import { cn } from "@/lib/utils";

import { Animal } from "./animal";
import { INK } from "./animal-drawings";

/** What a statuette shows: an animal of the band, or one of the four forms of the feats (#856). */
export type StatuetteShape = AnimalName | "laurel" | "chrono" | "witness" | "record";

/** The one set of medal gradients of the trophies: the showcase draws with this component. */
const METAL_RING: Record<Metal, string> = {
  gold: "bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to)",
  silver: "bg-gradient-to-b from-(--medal-silver-from) to-(--medal-silver-to)",
  bronze: "bg-gradient-to-b from-(--medal-bronze-from) to-(--medal-bronze-to)",
};

const EMPTY_GREY = "#9AA4B2";

/** A laurel leaf, its base at the origin, pointing up. */
const LEAF = "M0 0 C-3 -3 -3 -7 0 -10 C3 -7 3 -3 0 0 Z";

/** The four forms, on the 64 × 64 grid of the animals; `fill` is the metal or the empty grey. */
function FeatForm({
  shape,
  fill,
  center,
}: {
  shape: Exclude<StatuetteShape, AnimalName>;
  fill: string;
  center?: string;
}) {
  const label = (y: number, size: number): ReactNode =>
    center ? (
      <text
        x={32}
        y={y}
        textAnchor="middle"
        fontSize={size}
        fontWeight={800}
        fill={fill}
        fontFamily="var(--font-display, sans-serif)"
      >
        {center}
      </text>
    ) : null;
  switch (shape) {
    // A laurel wreath, open at the top, the place at its centre.
    case "laurel":
      return (
        <g>
          {[-1, 1].map((side) => (
            <g key={side} transform={`translate(32 32) scale(${side} 1)`}>
              <path
                d="M-4 20 C-18 16 -22 2 -16 -14"
                fill="none"
                stroke={fill}
                strokeWidth={2}
                strokeLinecap="round"
              />
              {[
                [-8, 19, -70],
                [-14, 13, -45],
                [-18, 5, -25],
                [-19, -4, -5],
                [-17, -12, 10],
              ].map(([x, y, angle]) => (
                <path
                  key={y}
                  d={LEAF}
                  fill={fill}
                  transform={`translate(${x} ${y}) rotate(${angle})`}
                />
              ))}
            </g>
          ))}
          {label(37, center && center.length > 3 ? 11 : 15)}
        </g>
      );
    // A stopwatch: its crown, its side button, its hands frozen.
    case "chrono":
      return (
        <g>
          <rect x={28} y={9} width={8} height={5} rx={1.5} fill={fill} />
          <rect x={30.5} y={13} width={3} height={4} fill={fill} />
          <path d="M45 18 l4 -4" stroke={fill} strokeWidth={3} strokeLinecap="round" />
          <circle cx={32} cy={36} r={17} fill="none" stroke={fill} strokeWidth={4} />
          <path d="M32 36 V25 M32 36 l7 5" stroke={fill} strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={32} cy={36} r={2} fill={fill} />
        </g>
      );
    // A relay baton, slanted, with its two grip rings.
    case "witness":
      return (
        <g transform="rotate(-35 32 32)">
          <rect x={10} y={26} width={44} height={12} rx={6} fill={fill} />
          <rect x={20} y={26} width={3} height={12} fill={INK} opacity={0.35} />
          <rect x={41} y={26} width={3} height={12} fill={INK} opacity={0.35} />
        </g>
      );
    // An engraved plaque, the points on it.
    case "record":
      return (
        <g>
          <rect x={13} y={17} width={38} height={30} rx={3} fill={fill} />
          <rect
            x={16}
            y={20}
            width={32}
            height={24}
            rx={2}
            fill="none"
            stroke={INK}
            strokeOpacity={0.4}
            strokeWidth={1.2}
          />
          {center ? (
            <text
              x={32}
              y={37}
              textAnchor="middle"
              fontSize={center.length > 3 ? 10 : 13}
              fontWeight={800}
              fill={INK}
              fontFamily="var(--font-mono, monospace)"
            >
              {center}
            </text>
          ) : (
            <path
              d="M21 29 H43 M24 35 H40"
              stroke={INK}
              strokeOpacity={0.4}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          )}
        </g>
      );
  }
}

/**
 * A trophy as a statuette (#768, #856): an animal of the band, or the form of a feat (laurel,
 * stopwatch, relay baton, engraved plaque), cast in gold, silver or bronze on a wooden base with
 * an engraved plaque. Without a metal the slot of the display case is still empty: a dashed frame
 * and, on the plaque, what it takes to win it.
 */
export function Statuette({
  shape,
  metal,
  title,
  plaque,
  center,
  className = "",
}: {
  shape: StatuetteShape;
  /** Null for an empty slot of the display case. */
  metal: Metal | null;
  /** The statuette's name: « Guépard d'or », « Chrono figé ». */
  title: string;
  /** The engraved lines: league, season; or, for an empty slot, how to win it. */
  plaque: string[];
  /** What the laurel or the plaque carries: the place, the points. */
  center?: string;
  className?: string;
}) {
  const gradient = useId();
  const animal =
    shape !== "laurel" && shape !== "chrono" && shape !== "witness" && shape !== "record";
  return (
    <figure
      data-metal={metal ?? "empty"}
      data-shape={shape}
      className={cn("flex w-full flex-col items-center", className)}
    >
      <span
        className={cn(
          "grid size-20 place-items-center rounded-full p-1.5 shadow-md",
          metal ? METAL_RING[metal] : "border-2 border-dashed border-[#9AA4B2] bg-[#D5DAE1]",
        )}
      >
        {animal ? (
          <Animal
            kind={metal ? shape : "locked"}
            size="large"
            className={cn("size-full", metal ? "" : "opacity-80")}
          />
        ) : (
          <svg viewBox="0 0 64 64" aria-hidden="true" className="size-full">
            {metal && (
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={`var(--medal-${metal}-from)`} />
                  <stop offset="1" stopColor={`var(--medal-${metal}-to)`} />
                </linearGradient>
              </defs>
            )}
            <circle cx={32} cy={32} r={31} fill={metal ? INK : "#D5DAE1"} />
            <FeatForm
              shape={shape}
              fill={metal ? `url(#${gradient})` : EMPTY_GREY}
              center={center}
            />
          </svg>
        )}
      </span>
      {/* The base: a dark wooden plinth in both themes, the plaque on it. */}
      <span
        aria-hidden="true"
        className={cn("-mt-1 h-3 w-14 rounded-t-sm", metal ? "bg-[#6B4226]" : "bg-[#9AA4B2]")}
      />
      <figcaption
        className={cn(
          "flex w-full flex-col items-center rounded-md px-1.5 py-1.5 text-center",
          metal
            ? "bg-[#4A2C17] text-[#F3E3C7]"
            : "border border-dashed border-border bg-muted text-muted-foreground",
        )}
      >
        <span className="max-w-full break-words text-xs font-extrabold leading-tight">{title}</span>
        {plaque.map((line) => (
          <span key={line} className="max-w-full break-words text-[11px] leading-tight">
            {line}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
