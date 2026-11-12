/**
 * The player's bib (#537): a number from 0 to 999 and one of six colours. It replaces the emoji
 * avatar; several players may wear the same bib.
 */
export const BIB_COLORS = ["blue", "red", "gold", "green", "white", "night"] as const;

export type BibColor = (typeof BIB_COLORS)[number];

export type Bib = { number: number; color: BibColor };

export const BIB_MAX = 999;

/** Shown when a stored bib breaks the rules (never expected: the database checks the same). */
export const DEFAULT_BIB: Bib = { number: 1, color: "blue" };

export type BibResult =
  { ok: true; bib: Bib } | { ok: false; code: "BIB_NUMBER_INVALID" | "BIB_COLOR_INVALID" };

// 1 to 3 ASCII digits, no leading zero (0 alone is allowed).
const NUMBER = /^(0|[1-9][0-9]{0,2})$/;

export function isBibColor(value: unknown): value is BibColor {
  return (BIB_COLORS as readonly unknown[]).includes(value);
}

/** Checks a bib typed in a form: the number as text, the colour as its code. */
export function validateBib(number: string, color: string): BibResult {
  const digits = number.trim();
  if (!NUMBER.test(digits)) return { ok: false, code: "BIB_NUMBER_INVALID" };
  if (!isBibColor(color)) return { ok: false, code: "BIB_COLOR_INVALID" };
  return { ok: true, bib: { number: Number(digits), color } };
}

/** A bib read from storage, or the default one when it breaks the rules. */
export function bibOf(number: unknown, color: unknown): Bib {
  if (
    typeof number === "number" &&
    Number.isInteger(number) &&
    number >= 0 &&
    number <= BIB_MAX &&
    isBibColor(color)
  ) {
    return { number, color };
  }
  return DEFAULT_BIB;
}

/** A bib drawn at random: number 1 to 99, any colour (same as the database default). */
export function randomBib(random: () => number = Math.random): Bib {
  const number = 1 + Math.floor(random() * 99);
  const color = BIB_COLORS[Math.floor(random() * BIB_COLORS.length)] ?? DEFAULT_BIB.color;
  return { number, color };
}
