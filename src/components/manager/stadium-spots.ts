import type { LineupPlace } from "@/domain/manager-lineup";

/**
 * Where the places of a lineup sit on the stadium seen from above (#775), in the units of its
 * drawing: 300 wide, 500 high, the home straight on the right. Sprint and hurdles on the home
 * straight, middle distance on the top bend, long distance on the bottom one, jumps on the runway
 * and its pit, throws in their circles and sector, combined events in between, free places on the
 * back straight. A family with more places than its zone takes the next free spot.
 */
export type StadiumSpot = { x: number; y: number };

export const STADIUM_WIDTH = 300;
export const STADIUM_HEIGHT = 500;

const column = (x: number): StadiumSpot[] => [210, 280, 140, 350].map((y) => ({ x, y }));
const straight = (x: number): StadiumSpot[] => [180, 250, 320].map((y) => ({ x, y }));

const HOME_STRAIGHT = straight(270);
const BACK_STRAIGHT = straight(30);
const TOP_BEND: StadiumSpot[] = [
  { x: 150, y: 32 },
  { x: 62, y: 72 },
  { x: 238, y: 72 },
];
const BOTTOM_BEND: StadiumSpot[] = TOP_BEND.map(({ x, y }) => ({ x, y: STADIUM_HEIGHT - y }));
const RUNWAY = column(92);
const MIDFIELD = column(150);
const CIRCLES = column(208);

const ZONES: Record<LineupPlace, StadiumSpot[]> = {
  sprint: HOME_STRAIGHT,
  middle: TOP_BEND,
  long: BOTTOM_BEND,
  jumps: RUNWAY,
  throws: CIRCLES,
  combined: MIDFIELD,
  free: [...BACK_STRAIGHT, ...MIDFIELD],
};

/** Every spot, in the order a family that overflows its zone takes them. */
const ALL: StadiumSpot[] = [
  ...HOME_STRAIGHT,
  ...BACK_STRAIGHT,
  ...TOP_BEND,
  ...BOTTOM_BEND,
  ...MIDFIELD,
  ...RUNWAY,
  ...CIRCLES,
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
