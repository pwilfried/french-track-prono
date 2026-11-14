// The FrenchTrack hare: one original drawing, the single source of the mascot. The <Hare>
// component draws it in the interface and scripts/app-icons.mjs turns it into the home-screen
// icons and the favicons (docs/DESIGN.md, "Icône de l'appli"). Plain data, no React, so Node can
// import it directly.

export const HARE_COLORS = { body: "#ffffff", outline: "#052B5C", band: "#E03020" } as const;

/**
 * body: white with the navy outline; band: the red headband; ribbon: its flying ends, a red line
 * over a navy one; ink: navy, no outline (eye, nose). `head` marks the parts of the head-only
 * variant used by the favicon.
 */
export type HarePaint = "body" | "band" | "ribbon" | "ink";
export type HarePart = { d: string; paint: HarePaint; head: boolean };

/** Back to front: each part is painted over the previous ones. */
export const HARE_PARTS: readonly HarePart[] = [
  // back ear
  { d: "M84 27C76 18 66 12 56 10C60 17 70 25 80 31Z", paint: "body", head: true },
  // far front leg
  {
    d: "M70 62C74 70 76 78 74 86C78 90 82 86 80 80C80 72 78 64 76 60Z",
    paint: "body",
    head: false,
  },
  // body and neck
  {
    d: "M26 58C28 44 46 36 64 37C72 37 78 32 84 30C92 34 90 48 84 56C78 64 66 70 52 72C38 74 25 70 26 58Z",
    paint: "body",
    head: false,
  },
  // tail
  { d: "M27 52C20 48 16 54 20 58C23 60 26 58 27 56Z", paint: "body", head: false },
  // haunch and hind leg pushing off
  {
    d: "M32 50C44 48 50 58 46 66C44 70 40 72 36 73L12 80C6 82 6 87 12 86L28 83C34 82 30 80 26 76C24 70 24 54 32 50Z",
    paint: "body",
    head: false,
  },
  // near front leg reaching forward
  {
    d: "M80 54C86 60 94 64 106 64C110 64 110 69 105 70C94 72 84 68 76 62Z",
    paint: "body",
    head: false,
  },
  // head
  {
    d: "M80 34C80 26 88 22 96 23C104 24 109 30 107 36C105 42 97 45 89 44C83 43 80 39 80 34Z",
    paint: "body",
    head: true,
  },
  // front ear
  { d: "M88 24C82 13 74 5 64 2C66 10 74 20 83 28Z", paint: "body", head: true },
  // headband ends flying back
  { d: "M83 28C76 28 70 32 62 30M83 28C77 25 72 22 67 18", paint: "ribbon", head: true },
  // headband
  {
    d: "M81.5 26C87 22.5 95 21.5 101 24L99.5 29.5C94 27.5 88 28 83 31.5Z",
    paint: "band",
    head: true,
  },
  // eye
  { d: "M94.8 33a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0Z", paint: "ink", head: true },
  // nose
  { d: "M105.2 35.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0Z", paint: "ink", head: true },
];

export type HareVariant = "full" | "head";

/** The running hare, or its head alone (favicon). */
export const HARE_VIEW_BOX: Record<HareVariant, string> = {
  full: "2 -1 112 93",
  head: "52 -6 60 60",
};

/** SVG attributes of each line drawn for a part, in painting order. */
export type HareStroke = {
  d: string;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
};

/** The head alone is drawn at favicon sizes (16 and 32 px): heavier lines keep it readable. */
const LINE_WEIGHT: Record<HareVariant, number> = { full: 1, head: 1.6 };

export function hareStrokes(variant: HareVariant): HareStroke[] {
  const { body, outline, band } = HARE_COLORS;
  const w = LINE_WEIGHT[variant];
  return HARE_PARTS.filter((part) => variant === "full" || part.head).flatMap(
    ({ d, paint }): HareStroke[] => {
      switch (paint) {
        case "body":
          return [{ d, fill: body, stroke: outline, strokeWidth: 3.5 * w }];
        case "band":
          return [{ d, fill: band, stroke: outline, strokeWidth: 2 * w }];
        case "ribbon":
          return [
            { d, fill: "none", stroke: outline, strokeWidth: 6 * w },
            { d, fill: "none", stroke: band, strokeWidth: 3 * w },
          ];
        case "ink":
          return [{ d, fill: outline }];
      }
    },
  );
}

/** Standalone SVG document of the hare, for the icon generator. */
export function hareSvg(variant: HareVariant): string {
  const paths = hareStrokes(variant)
    .map(({ d, fill, stroke, strokeWidth }) =>
      stroke
        ? `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
        : `<path d="${d}" fill="${fill}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${HARE_VIEW_BOX[variant]}" stroke-linejoin="round" stroke-linecap="round">${paths}</svg>`;
}
