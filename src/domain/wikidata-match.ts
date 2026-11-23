// Which Wikidata item is our athlete (docs/decisions/athletes-wikidata.md, section 6, #1192).
// Pure rules on the entities as wbgetentities gives them: no network here.

import type { EventGender } from "./event";

/** One value of a statement: an item ({ id }), a time, a quantity or a string. */
export type WikidataSnak = {
  snaktype: string;
  datavalue?: { type: string; value: unknown };
};

export type WikidataStatement = {
  rank: "preferred" | "normal" | "deprecated";
  mainsnak: WikidataSnak;
  qualifiers?: Record<string, WikidataSnak[]>;
};

/** The fields of a Wikidata entity we read, in the shape of the wbgetentities answer. */
export type WikidataEntity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, WikidataStatement[]>;
  sitelinks?: Record<string, { title: string }>;
};

/** What we know of our athlete to find them in Wikidata. */
export type AthleteToMatch = { name: string; countryCode: string; gender: EventGender };

/**
 * "linked": one sure item, saved on its own. "to_review": the admin chooses among the
 * candidates (maybe none), or marks the athlete as absent from Wikidata.
 */
export type WikidataMatch =
  { status: "linked"; id: string } | { status: "to_review"; candidateIds: string[] };

/** Languages whose labels and aliases we read: 7 items had no English label (section 4). */
export const LABEL_LANGUAGES = ["en", "fr", "mul"] as const;

const HUMAN = "Q5";
const ATHLETICS = "Q542";
const ATHLETICS_COMPETITOR = "Q11513337";
const OPPOSITE_SEX: Partial<Record<EventGender, string>> = {
  F: "Q6581097", // male
  M: "Q6581072", // female
};

// Letters NFD does not split into a base letter and an accent.
const PLAIN_LETTERS: Record<string, string> = {
  ł: "l",
  ø: "o",
  đ: "d",
  ð: "d",
  ß: "ss",
  æ: "ae",
  œ: "oe",
  þ: "th",
  ı: "i",
};

/** A name without accents nor case, words separated by one space: "Molnár" is "molnar". */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[łøđðßæœþı]/g, (letter) => PLAIN_LETTERS[letter])
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The values of a property that are items, skipping deprecated statements. */
export function itemIds(entity: WikidataEntity, property: string): string[] {
  return (entity.claims?.[property] ?? [])
    .filter((statement) => statement.rank !== "deprecated")
    .map((statement) => snakItemId(statement.mainsnak))
    .filter((id): id is string => id !== null);
}

export function snakItemId(snak: WikidataSnak | undefined): string | null {
  const value = snak?.datavalue?.value as { id?: unknown } | undefined;
  return typeof value?.id === "string" ? value.id : null;
}

/** The countries to look up for the IOC codes: sports country (P1532), then citizenship (P27). */
export function countryIdsOf(entity: WikidataEntity): string[] {
  return [...new Set([...itemIds(entity, "P1532"), ...itemIds(entity, "P27")])];
}

/** The IOC code (P984) of a country item, the same three letters as athletes.country_code. */
export function iocCodeOf(country: WikidataEntity): string | null {
  const value = country.claims?.P984?.find((s) => s.rank !== "deprecated")?.mainsnak.datavalue
    ?.value;
  return typeof value === "string" ? value : null;
}

/** IOC codes of the athlete: of the sports countries, or of the citizenships when none has one. */
function countryCodes(entity: WikidataEntity, iocCodes: ReadonlyMap<string, string>): string[] {
  const codes = (property: string) =>
    itemIds(entity, property)
      .map((id) => iocCodes.get(id))
      .filter((code): code is string => code !== undefined);
  const sports = codes("P1532");
  return sports.length > 0 ? sports : codes("P27");
}

function labels(entity: WikidataEntity): string[] {
  return LABEL_LANGUAGES.map((language) => entity.labels?.[language]?.value).filter(
    (label): label is string => label !== undefined,
  );
}

function aliases(entity: WikidataEntity): string[] {
  return LABEL_LANGUAGES.flatMap((language) =>
    (entity.aliases?.[language] ?? []).map((alias) => alias.value),
  );
}

/** A human linked to athletics, of our country, not of the opposite sex. */
function isPlausible(
  entity: WikidataEntity,
  athlete: AthleteToMatch,
  iocCodes: ReadonlyMap<string, string>,
): boolean {
  const opposite = OPPOSITE_SEX[athlete.gender];
  const sexes = itemIds(entity, "P21");
  return (
    itemIds(entity, "P31").includes(HUMAN) &&
    (itemIds(entity, "P641").includes(ATHLETICS) ||
      itemIds(entity, "P106").includes(ATHLETICS_COMPETITOR)) &&
    countryCodes(entity, iocCodes).includes(athlete.countryCode) &&
    !(sexes.length > 0 && sexes.every((sex) => sex === opposite))
  );
}

/**
 * Section 6 of the decision. The candidates are the search results (English, then French) read
 * with wbgetentities; `iocCodes` maps their country items to IOC codes. Sure only when one
 * plausible candidate is left and its label is our name. A plausible result that bears our name
 * neither in a label nor in an alias is dropped (Bacon for Bednarek), unless none bears it: the
 * admin then sees every plausible one. Never an automatic choice between two candidates.
 */
export function matchWikidata(
  athlete: AthleteToMatch,
  candidates: WikidataEntity[],
  iocCodes: ReadonlyMap<string, string>,
): WikidataMatch {
  const key = nameKey(athlete.name);
  const unique = [...new Map(candidates.map((entity) => [entity.id, entity])).values()];
  const plausible = unique.filter((entity) => isPlausible(entity, athlete, iocCodes));
  const hasLabel = (entity: WikidataEntity) => labels(entity).some((l) => nameKey(l) === key);
  const named = plausible.filter(
    (entity) => hasLabel(entity) || aliases(entity).some((alias) => nameKey(alias) === key),
  );
  if (named.length === 1 && hasLabel(named[0])) return { status: "linked", id: named[0].id };
  const shown = named.length > 0 ? named : plausible;
  return { status: "to_review", candidateIds: shown.map((entity) => entity.id) };
}
