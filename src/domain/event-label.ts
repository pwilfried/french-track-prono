/** The gender words a discipline name may already carry (« Relais mixte 4x100 m »). */
const GENDER_WORD = /(^|\s)(mixte|femmes|hommes)(\s|$)/i;

/**
 * An event's label: the discipline, then the gender word in lower case, unless the discipline
 * name already carries a gender (« Relais mixte 4x100 m », never « … mixte mixte »).
 */
export function eventLabel(discipline: string, gender: string): string {
  return GENDER_WORD.test(discipline) ? discipline : `${discipline} ${gender.toLowerCase()}`;
}
