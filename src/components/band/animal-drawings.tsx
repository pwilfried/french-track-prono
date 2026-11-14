import type { ReactNode } from "react";

import type { Animal } from "@/domain/band";

/**
 * The drawings of the band (#768), first version from the mockup sketches: an original head per
 * animal, drawn on a 64 × 64 grid inside a round medallion. Final drawings replace the entries of
 * this file alone; the `Animal` component and its callers do not change.
 *
 * Fixed colours, the same in both themes: a medallion is an object, like a bib.
 */
export const INK = "#052B5C";
const WHITE = "#FFFFFF";
const PINK = "#F4A9A0";

export type AnimalDrawing = {
  /** The medallion behind the head. */
  disc: string;
  /** The head itself. */
  fur: string;
  head: ReactNode;
};

function Eyes({ y = 36, gap = 6 }: { y?: number; gap?: number }) {
  return (
    <>
      <circle cx={32 - gap} cy={y} r={2.4} fill={INK} />
      <circle cx={32 + gap} cy={y} r={2.4} fill={INK} />
      <circle cx={32 - gap + 0.8} cy={y - 0.8} r={0.7} fill={WHITE} />
      <circle cx={32 + gap + 0.8} cy={y - 0.8} r={0.7} fill={WHITE} />
    </>
  );
}

function Nose({ y = 43 }: { y?: number }) {
  return <path d={`M29.5 ${y} h5 l-2.5 3 z`} fill={INK} />;
}

export const ANIMAL_DRAWINGS: Record<Animal, AnimalDrawing> = {
  // The mascot: long ears straight up, ready for the start.
  lievre: {
    disc: "#FFC857",
    fur: "#F3E3C7",
    head: (
      <>
        <ellipse cx={24} cy={17} rx={5} ry={14} fill="#F3E3C7" transform="rotate(-8 24 17)" />
        <ellipse cx={40} cy={17} rx={5} ry={14} fill="#F3E3C7" transform="rotate(8 40 17)" />
        <ellipse cx={24} cy={18} rx={2.2} ry={10} fill={PINK} transform="rotate(-8 24 18)" />
        <ellipse cx={40} cy={18} rx={2.2} ry={10} fill={PINK} transform="rotate(8 40 18)" />
        <ellipse cx={32} cy={41} rx={14} ry={13} fill="#F3E3C7" />
        <Eyes y={38} />
        <Nose y={44} />
        <path
          d="M32 47 v2.5 M32 49.5 q-3 2 -5 0 M32 49.5 q3 2 5 0"
          stroke={INK}
          strokeWidth={1.2}
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
  // Sprint: round head, small ears, the dark tear lines and spots.
  guepard: {
    disc: "#084595",
    fur: "#F2B33D",
    head: (
      <>
        <circle cx={19} cy={24} r={5.5} fill="#F2B33D" />
        <circle cx={45} cy={24} r={5.5} fill="#F2B33D" />
        <circle cx={19} cy={24} r={2.5} fill={INK} />
        <circle cx={45} cy={24} r={2.5} fill={INK} />
        <circle cx={32} cy={38} r={16} fill="#F2B33D" />
        <ellipse cx={32} cy={46} rx={8} ry={5.5} fill="#FFF3D6" />
        <path
          d="M25 38 q-1 6 2 11 M39 38 q1 6 -2 11"
          stroke={INK}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
        <circle cx={22} cy={29} r={1.3} fill={INK} />
        <circle cx={28} cy={26} r={1.3} fill={INK} />
        <circle cx={36} cy={26} r={1.3} fill={INK} />
        <circle cx={42} cy={29} r={1.3} fill={INK} />
        <circle cx={19} cy={36} r={1.1} fill={INK} />
        <circle cx={45} cy={36} r={1.1} fill={INK} />
        <Eyes y={35} />
        <Nose y={43} />
      </>
    ),
  },
  // Hurdles: a long head and lyre-shaped horns.
  impala: {
    disc: "#2BB673",
    fur: "#C8875A",
    head: (
      <>
        <path
          d="M27 25 C22 19 27 13 22 5 M37 25 C42 19 37 13 42 5"
          stroke={INK}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx={18} cy={30} rx={7} ry={3.5} fill="#C8875A" transform="rotate(-20 18 30)" />
        <ellipse cx={46} cy={30} rx={7} ry={3.5} fill="#C8875A" transform="rotate(20 46 30)" />
        <ellipse cx={32} cy={39} rx={11} ry={16} fill="#C8875A" />
        <ellipse cx={32} cy={50} rx={7} ry={5} fill="#F6E7D6" />
        <Eyes y={35} gap={5.5} />
        <ellipse cx={29.5} cy={50} rx={1.2} ry={0.9} fill={INK} />
        <ellipse cx={34.5} cy={50} rx={1.2} ry={0.9} fill={INK} />
      </>
    ),
  },
  // Long and triple jump: tall pointed ears, a soft muzzle.
  kangourou: {
    disc: "#E03020",
    fur: "#D9945E",
    head: (
      <>
        <ellipse cx={21} cy={20} rx={5} ry={11} fill="#D9945E" transform="rotate(-22 21 20)" />
        <ellipse cx={43} cy={20} rx={5} ry={11} fill="#D9945E" transform="rotate(22 43 20)" />
        <ellipse cx={21} cy={21} rx={2.2} ry={7} fill="#F3C9A6" transform="rotate(-22 21 21)" />
        <ellipse cx={43} cy={21} rx={2.2} ry={7} fill="#F3C9A6" transform="rotate(22 43 21)" />
        <ellipse cx={32} cy={39} rx={13} ry={15} fill="#D9945E" />
        <ellipse cx={32} cy={47} rx={8.5} ry={6.5} fill="#F3C9A6" />
        <Eyes y={36} />
        <ellipse cx={32} cy={44.5} rx={3} ry={2} fill={INK} />
        <path d="M32 46.5 v3" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
      </>
    ),
  },
  // Pole vault and high jump: pointed ears and whiskers.
  chat: {
    disc: "#B8C2D3",
    fur: "#5B6B82",
    head: (
      <>
        <path d="M17 31 L19 13 L30 23 Z M47 31 L45 13 L34 23 Z" fill="#5B6B82" />
        <path d="M20 26 L21 17 L26 22 Z M44 26 L43 17 L38 22 Z" fill={PINK} />
        <circle cx={32} cy={38} r={16} fill="#5B6B82" />
        <ellipse cx={32} cy={45} rx={7} ry={5} fill="#E4E8EF" />
        <circle cx={26} cy={36} r={3.2} fill="#FFE07A" />
        <circle cx={38} cy={36} r={3.2} fill="#FFE07A" />
        <ellipse cx={26} cy={36} rx={1} ry={2.6} fill={INK} />
        <ellipse cx={38} cy={36} rx={1} ry={2.6} fill={INK} />
        <Nose y={42} />
        <path
          d="M24 45 h-9 M24 47 l-8 2 M40 45 h9 M40 47 l8 2"
          stroke={WHITE}
          strokeWidth={1}
          strokeLinecap="round"
        />
      </>
    ),
  },
  // Throws: a big round head, round ears, a broad muzzle.
  ours: {
    disc: "#F3E3C7",
    fur: "#8A5A3B",
    head: (
      <>
        <circle cx={18} cy={24} r={7} fill="#8A5A3B" />
        <circle cx={46} cy={24} r={7} fill="#8A5A3B" />
        <circle cx={18} cy={24} r={3.5} fill="#C99772" />
        <circle cx={46} cy={24} r={3.5} fill="#C99772" />
        <circle cx={32} cy={38} r={17} fill="#8A5A3B" />
        <ellipse cx={32} cy={46} rx={9} ry={7} fill="#E3C2A0" />
        <circle cx={25.5} cy={35} r={2.6} fill={WHITE} />
        <circle cx={38.5} cy={35} r={2.6} fill={WHITE} />
        <circle cx={25.5} cy={35.4} r={1.6} fill={INK} />
        <circle cx={38.5} cy={35.4} r={1.6} fill={INK} />
        <ellipse cx={32} cy={43.5} rx={3.6} ry={2.4} fill={INK} />
        <path
          d="M32 46 v2.5 M32 48.5 q-3 2 -5 0 M32 48.5 q3 2 5 0"
          stroke={INK}
          strokeWidth={1.2}
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
  // Combined events: a pointed face with white cheeks, good at everything.
  renard: {
    disc: "#052B5C",
    fur: "#E8672C",
    head: (
      <>
        <path d="M15 32 L17 11 L30 24 Z M49 32 L47 11 L34 24 Z" fill="#E8672C" />
        <path d="M18 25 L19 16 L26 22 Z M46 25 L45 16 L38 22 Z" fill={INK} />
        <path d="M14 30 Q32 18 50 30 L36 52 Q32 56 28 52 Z" fill="#E8672C" />
        <path d="M14 30 Q22 40 32 42 Q42 40 50 30 L36 52 Q32 56 28 52 Z" fill={WHITE} />
        <Eyes y={34} gap={7} />
        <ellipse cx={32} cy={51} rx={2.6} ry={2} fill={INK} />
      </>
    ),
  },
};
