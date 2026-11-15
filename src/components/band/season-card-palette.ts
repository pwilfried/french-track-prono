import type { Animal } from "@/domain/band";

const BLUE = "#084595";
const CREAM = "#F3E3C7";

/**
 * The colours of the shared season card (#900), one pair per animal of the band: a background in
 * the animal's tints (see `ANIMAL_DRAWINGS`), FrenchTrack blue on the light ones, cream on the
 * bear's dark brown. Every pair passes AA (tested). Fixed colours: the card is an image.
 */
export const SEASON_CARD_PALETTE: Record<Animal, { background: string; text: string }> = {
  lievre: { background: "#FFC857", text: BLUE },
  guepard: { background: "#F2B33D", text: BLUE },
  impala: { background: "#7FD4A6", text: BLUE },
  kangourou: { background: "#F7B5A8", text: BLUE },
  chat: { background: "#B8C2D3", text: BLUE },
  ours: { background: "#5A3A24", text: CREAM },
  renard: { background: "#F6B48A", text: BLUE },
};
