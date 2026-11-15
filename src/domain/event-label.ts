/** The gender words a discipline name may already carry (« Relais mixte 4x100 m »). */
const GENDER_WORD = /(^|\s)(mixte|femmes|hommes)(\s|$)/i;

/** A number, a space, then a unit standing alone (« 4x100 m », « 12 pts »). */
const NUMBER_UNIT = /(\d) (?=(?:k?m|kg|s|pts?)(?![\p{L}\d]))/gu;

/** Joins every number to its unit with a no-break space, so « 4x100 m » never wraps (#939). */
export function keepUnits(text: string): string {
  return text.replace(NUMBER_UNIT, "$1 ");
}

/**
 * An event's label: the discipline, then the gender word in lower case, unless the discipline
 * name already carries a gender (« Relais mixte 4x100 m », never « … mixte mixte »).
 */
export function eventLabel(discipline: string, gender: string): string {
  return keepUnits(
    GENDER_WORD.test(discipline) ? discipline : `${discipline} ${gender.toLowerCase()}`,
  );
}
