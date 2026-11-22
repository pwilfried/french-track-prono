import type { DisciplineFamily } from "./discipline";
import { matchesWords } from "./list-view";
import { managerFamilyOf, type ManagerFamily, type ManagerSex } from "./manager-rules";

/**
 * An athlete of the mercato catalogue of a league (v0.13, #421). Only athletes the admin gave a
 * price to are in it; the price is the lowest bid (#441).
 */
export type CatalogueAthlete = {
  athleteId: string;
  slug: string;
  name: string;
  countryCode: string;
  sex: ManagerSex;
  /** The athlete's main discipline and its family. */
  discipline: string;
  family: DisciplineFamily;
  pb: string | null;
  sb: string | null;
  price: number;
  /** Not yet in a team of the league. */
  available: boolean;
};

export type CatalogueFilter = {
  sex: ManagerSex | null;
  /** One of the four Manager families (#1017). */
  family: ManagerFamily | null;
  /** One discipline, e.g. « 200 m »; the page offers it once a family is chosen (#1087). */
  discipline: string | null;
  availableOnly: boolean;
  /** Only athletes priced at most this (what the player has left); null keeps all. */
  maxPrice: number | null;
  /** Only these athletes (the player's bids); null keeps all. */
  onlyIds: ReadonlySet<string> | null;
};

/** Whether an athlete passes the filters of the catalogue. */
export const inCatalogueFilter = (a: CatalogueAthlete, f: CatalogueFilter) =>
  (!f.sex || a.sex === f.sex) &&
  (!f.family || managerFamilyOf(a.family) === f.family) &&
  (!f.discipline || a.discipline === f.discipline) &&
  (!f.availableOnly || a.available) &&
  (f.maxPrice === null || a.price <= f.maxPrice) &&
  (!f.onlyIds || f.onlyIds.has(a.athleteId));

/** How the catalogue is ordered: dearest first by default (#1087). */
export const CATALOGUE_SORTS = ["price_desc", "price_asc", "name"] as const;
export type CatalogueSort = (typeof CATALOGUE_SORTS)[number];
export const DEFAULT_CATALOGUE_SORT: CatalogueSort = "price_desc";

const byName = (a: CatalogueAthlete, b: CatalogueAthlete) =>
  a.name.localeCompare(b.name, "fr", { sensitivity: "base" });

/** The comparison of a sort; equal prices fall back to the name so the order is stable. */
export const compareCatalogue =
  (sort: CatalogueSort) => (a: CatalogueAthlete, b: CatalogueAthlete) =>
    sort === "price_desc"
      ? b.price - a.price || byName(a, b)
      : sort === "price_asc"
        ? a.price - b.price || byName(a, b)
        : byName(a, b);

/** The disciplines of a family in the catalogue, in alphabetical order, each once. */
export const catalogueDisciplines = (athletes: CatalogueAthlete[], family: ManagerFamily) =>
  [
    ...new Set(
      athletes.filter((a) => managerFamilyOf(a.family) === family).map((a) => a.discipline),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" }));

/**
 * A priced athlete the catalogue still leaves out: it lists athletes by their main discipline, so
 * one without it never shows (#594). The admin sees the gap; without a price, it is on purpose.
 */
export const missesCatalogueForMainDiscipline = (a: {
  managerPrice: number | null;
  mainDiscipline: string | null;
}) => a.managerPrice !== null && a.mainDiscipline === null;

/** The search looks at the name, the country and the discipline. */
export const matchesCatalogueSearch = (a: CatalogueAthlete, normalizedQuery: string) =>
  matchesWords(`${a.name} ${a.countryCode} ${a.discipline}`, normalizedQuery);
