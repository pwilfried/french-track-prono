import type { LineupPlace } from "@/domain/manager-lineup";

/**
 * Where the places of a lineup sit on the stadium seen from above (#775), as in the validated
 * mock-up « Confrontation stade contre stade »: in percent of the width (x) and of the height (y)
 * of the stadium. Races on the track: sprint at the bottom of the home straight (« 100 m »), then
 * the left bend (« 400 m »); middle and long distance on the right bend (« 1500 m »); the back
 * straight at the top takes an eighth place. Field events on the grass: jumps at the top
 * (« hauteur ») then on the left (« longueur »), throws on the right (« javelot ») then in the
 * centre (« poids »), combined events in the centre. Free places take the spots left, in the
 * order of the mock-up. A family with more places than its zone takes the next free spot.
 */
export type StadiumSpot = { x: number; y: number };

/** The height of the stadium for a width of 1: an oval a little wider than high. */
export const STADIUM_RATIO = 0.92;

/** The width of a card, in percent of the stadium: four fit side by side on the middle row. */
export const CARD_WIDTH = 23.5;

const BOTTOM_STRAIGHT: StadiumSpot = { x: 50, y: 91 };
const LEFT_BEND: StadiumSpot = { x: 12, y: 50 };
const RIGHT_BEND: StadiumSpot = { x: 88, y: 50 };
const BACK_STRAIGHT: StadiumSpot = { x: 50, y: 9 };
const HIGH_JUMP: StadiumSpot = { x: 50, y: 29 };
const LONG_JUMP: StadiumSpot = { x: 37, y: 50 };
const JAVELIN: StadiumSpot = { x: 63, y: 50 };
const SHOT_PUT: StadiumSpot = { x: 50, y: 71 };

const ZONES: Record<LineupPlace, StadiumSpot[]> = {
  sprint: [BOTTOM_STRAIGHT, LEFT_BEND, BACK_STRAIGHT],
  middle: [RIGHT_BEND, LEFT_BEND, BACK_STRAIGHT],
  long: [RIGHT_BEND, BACK_STRAIGHT, LEFT_BEND],
  jumps: [HIGH_JUMP, LONG_JUMP],
  throws: [JAVELIN, SHOT_PUT],
  combined: [SHOT_PUT, HIGH_JUMP],
  free: [LEFT_BEND, HIGH_JUMP, LONG_JUMP, SHOT_PUT, BACK_STRAIGHT, JAVELIN, RIGHT_BEND],
};

/** Every spot, in the order a family that overflows its zone takes them. */
const ALL: StadiumSpot[] = [
  BOTTOM_STRAIGHT,
  LEFT_BEND,
  RIGHT_BEND,
  BACK_STRAIGHT,
  HIGH_JUMP,
  LONG_JUMP,
  JAVELIN,
  SHOT_PUT,
];

export const STADIUM_SPOTS = ALL.length;

/** One spot per place, in the order of the places; null for a place beyond the stadium. */
export function stadiumSpots(places: LineupPlace[]): (StadiumSpot | null)[] {
  const taken = new Set<StadiumSpot>();
  return places.map((place) => {
    const spot = ZONES[place].find((s) => !taken.has(s)) ?? ALL.find((s) => !taken.has(s)) ?? null;
    if (spot) taken.add(spot);
    return spot;
  });
}
