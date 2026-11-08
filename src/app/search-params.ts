/** A query parameter given once or several times (`?competition=a&competition=b`), as a list. */
export const paramList = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/** A query parameter given once, or undefined (missing or repeated). */
export const paramText = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;
