import type { DisciplineFamily } from "./discipline";
import { matchesWords } from "./list-view";
import type { ManagerSex } from "./manager-rules";

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
  family: DisciplineFamily | null;
  availableOnly: boolean;
};

/** Whether an athlete passes the filters of the catalogue. */
export const inCatalogueFilter = (a: CatalogueAthlete, f: CatalogueFilter) =>
  (!f.sex || a.sex === f.sex) &&
  (!f.family || a.family === f.family) &&
  (!f.availableOnly || a.available);

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
