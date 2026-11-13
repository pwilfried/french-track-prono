import type { ManagerSex } from "./manager-rules";
import { WORLD_ATHLETICS_TABLES } from "./world-athletics-tables";

/** The World Athletics event key of each discipline the scoring tables cover. */
const EVENT_KEYS: Record<string, string> = {
  "100 m": "100m",
  "200 m": "200m",
  "400 m": "400m",
  "100 m haies": "100mh",
  "110 m haies": "110mh",
  "400 m haies": "400mh",
  "800 m": "800m",
  "1500 m": "1500m",
  "3000 m steeple": "3000mSt",
  "5000 m": "5000m",
  "10 000 m": "10000m",
  Marathon: "marathon",
  "Saut en longueur": "long_jump",
  "Triple saut": "triple_jump",
  "Saut en hauteur": "high_jump",
  "Saut à la perche": "pole_vault",
  "Lancer du poids": "shot_put",
  "Lancer du disque": "discus_throw",
  "Lancer du marteau": "hammer_throw",
  Javelot: "javelin_throw",
  Heptathlon: "heptathlon",
  Décathlon: "decathlon",
  "Relais 4x100 m": "4x100m",
  "Relais 4x400 m": "4x400m",
  "Relais mixte 4x400 m": "mixed_4x400m",
};

/**
 * Points of a mark in the World Athletics scoring tables (the « Hungarian » tables, #428): seconds
 * for a race, metres for a jump or a throw, the official total for a combined event. The place
 * does not count. Null when the tables have no event for this discipline and sex.
 */
export function worldAthleticsPoints(
  discipline: string,
  sex: ManagerSex,
  mark: number,
): number | null {
  const key = Object.hasOwn(EVENT_KEYS, discipline) ? EVENT_KEYS[discipline] : undefined;
  const table = key === undefined ? undefined : WORLD_ATHLETICS_TABLES[sex][key];
  if (!table) return null;
  if (!Number.isFinite(mark) || mark <= 0) return 0;
  const shifted = mark + table.shift;
  // A race: a negative shift is the time worth 0 points, anything slower scores nothing.
  if (table.shift < 0 && shifted >= 0) return 0;
  return Math.max(0, Math.floor(table.factor * shifted * shifted + table.offset));
}
