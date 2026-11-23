// What we take from the Wikidata item of an athlete (docs/decisions/athletes-wikidata.md,
// section 5, #1192): birth date, Wikipedia link, disciplines, best personal record per
// discipline. No medals, no photo, no World Athletics id.

import type { MarkUnit } from "./discipline";
import { itemIds, snakItemId, type WikidataEntity, type WikidataSnak } from "./wikidata-match";

/** A personal best read from P2415, in the unit of our discipline (seconds, metres, points). */
export type WikidataBest = {
  discipline: string;
  mark: number;
  /** "YYYY-MM-DD" from P585 (point in time) or P580 (start time); null when undated. */
  date: string | null;
  /** The item of the venue (P276); its name is read apart. */
  venueId: string | null;
};

export type WikidataAthlete = {
  id: string;
  /** "YYYY-MM-DD"; null when Wikidata gives no day. */
  birthDate: string | null;
  /** French article, else English one. */
  wikipediaUrl: string | null;
  /** Our disciplines (P2416), the ones the table below knows, in Wikidata's order. */
  disciplines: string[];
  personalBests: WikidataBest[];
};

/**
 * Wikidata disciplines → ours, written by hand: never matched by label (section 5).
 * Relays are left aside (team events, no personal best).
 */
export const WIKIDATA_DISCIPLINES: Record<string, { name: string; unit: MarkUnit }> = {
  Q164761: { name: "100 m", unit: "time" },
  Q211155: { name: "200 m", unit: "time" },
  Q334734: { name: "400 m", unit: "time" },
  Q164731: { name: "100 m haies", unit: "time" },
  Q170004: { name: "110 m haies", unit: "time" },
  Q231419: { name: "400 m haies", unit: "time" },
  Q271008: { name: "800 m", unit: "time" },
  Q191691: { name: "1500 m", unit: "time" },
  Q10437559: { name: "3000 m steeple", unit: "time" },
  Q240500: { name: "5000 m", unit: "time" },
  Q163892: { name: "10 000 m", unit: "time" },
  Q40244: { name: "Marathon", unit: "time" },
  Q170737: { name: "Saut en longueur", unit: "distance" },
  Q187204: { name: "Triple saut", unit: "distance" },
  Q165704: { name: "Saut en hauteur", unit: "distance" },
  Q185027: { name: "Saut à la perche", unit: "distance" },
  Q180935: { name: "Lancer du poids", unit: "distance" },
  Q182570: { name: "Lancer du disque", unit: "distance" },
  Q184865: { name: "Lancer du marteau", unit: "distance" },
  Q178108: { name: "Javelot", unit: "distance" },
  Q243264: { name: "Heptathlon", unit: "points" },
  Q184654: { name: "Décathlon", unit: "points" },
};

const ENTITY = "http://www.wikidata.org/entity/";

/** Units of P2415 we read, and how to bring them to seconds, metres or points. */
const UNITS: Record<string, { unit: MarkUnit; factor: number }> = {
  [`${ENTITY}Q11574`]: { unit: "time", factor: 1 }, // second
  [`${ENTITY}Q7727`]: { unit: "time", factor: 60 }, // minute
  [`${ENTITY}Q25235`]: { unit: "time", factor: 3600 }, // hour
  [`${ENTITY}Q11573`]: { unit: "distance", factor: 1 }, // metre
  [`${ENTITY}Q174728`]: { unit: "distance", factor: 0.01 }, // centimetre
  [`${ENTITY}Q3393320`]: { unit: "points", factor: 1 }, // point
  "1": { unit: "points", factor: 1 }, // no unit: a points total
};

/** A day from a Wikidata time ("+1999-11-10T00:00:00Z", precision 11); null otherwise. */
function day(snak: WikidataSnak | undefined): string | null {
  const value = snak?.datavalue?.value as { time?: unknown; precision?: unknown } | undefined;
  if (typeof value?.time !== "string" || typeof value.precision !== "number") return null;
  if (value.precision < 11) return null;
  const match = /^\+(\d{4}-\d{2}-\d{2})T/.exec(value.time);
  return match ? match[1] : null;
}

/** The amount of a quantity in seconds, metres or points; null for an unknown unit. */
function amount(snak: WikidataSnak, unit: MarkUnit): number | null {
  const value = snak.datavalue?.value as { amount?: unknown; unit?: unknown } | undefined;
  if (typeof value?.amount !== "string" || typeof value.unit !== "string") return null;
  const known = UNITS[value.unit];
  const number = Number(value.amount);
  if (!known || known.unit !== unit || !Number.isFinite(number) || number <= 0) return null;
  // Rounded to the hundredth: 1236 cm is 12.36 m, not 12.360000000000001.
  return Math.round(number * known.factor * 100) / 100;
}

function wikipediaUrl(entity: WikidataEntity): string | null {
  for (const [site, host] of [
    ["frwiki", "fr.wikipedia.org"],
    ["enwiki", "en.wikipedia.org"],
  ] as const) {
    const title = entity.sitelinks?.[site]?.title;
    if (title) return `https://${host}/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
  }
  return null;
}

type Mark = WikidataBest & { preferred: boolean; lowerIsBetter: boolean };

function marks(entity: WikidataEntity): Mark[] {
  return (entity.claims?.P2415 ?? []).flatMap((statement) => {
    if (statement.rank === "deprecated") return [];
    const discipline = WIKIDATA_DISCIPLINES[snakItemId(statement.qualifiers?.P2416?.[0]) ?? ""];
    if (!discipline) return [];
    const mark = amount(statement.mainsnak, discipline.unit);
    if (mark === null) return [];
    const q = statement.qualifiers ?? {};
    return [
      {
        discipline: discipline.name,
        mark,
        date: day(q.P585?.[0]) ?? day(q.P580?.[0]),
        venueId: snakItemId(q.P276?.[0]),
        preferred: statement.rank === "preferred",
        lowerIsBetter: discipline.unit === "time",
      },
    ];
  });
}

/**
 * The best personal record of each discipline. Wikidata often keeps the progression of a record
 * (six statements for Duplantis): the preferred statement wins when there is one, else the best
 * mark (lowest time, highest distance or points).
 */
function personalBests(entity: WikidataEntity): WikidataBest[] {
  const byDiscipline = new Map<string, Mark[]>();
  for (const mark of marks(entity)) {
    byDiscipline.set(mark.discipline, [...(byDiscipline.get(mark.discipline) ?? []), mark]);
  }
  return [...byDiscipline.values()].map((all) => {
    const preferred = all.filter((mark) => mark.preferred);
    const pool = preferred.length > 0 ? preferred : all;
    const best = pool.reduce((a, b) =>
      (a.lowerIsBetter ? b.mark < a.mark : b.mark > a.mark) ? b : a,
    );
    return { discipline: best.discipline, mark: best.mark, date: best.date, venueId: best.venueId };
  });
}

/** Everything we take from the item of an athlete. */
export function readWikidataAthlete(entity: WikidataEntity): WikidataAthlete {
  const disciplines = itemIds(entity, "P2416")
    .map((id) => WIKIDATA_DISCIPLINES[id]?.name)
    .filter((name): name is string => name !== undefined);
  return {
    id: entity.id,
    birthDate: day(entity.claims?.P569?.find((s) => s.rank !== "deprecated")?.mainsnak),
    wikipediaUrl: wikipediaUrl(entity),
    disciplines: [...new Set(disciplines)],
    personalBests: personalBests(entity),
  };
}
