/** Lower case, without accents or surrounding spaces: « Étoile » is found by « etoile ». */
/** A search box takes this many characters at most; beyond, the rest is not read (#712). */
export const SEARCH_MAX_LENGTH = 60;

export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Whether every word of the search is somewhere in the text, in any order (#412): « bondy athle »
 * finds « Athlé Bondy ». Accents, case and punctuation are ignored. The query is already normalized.
 */
export function matchesWords(text: string, normalizedQuery: string): boolean {
  const haystack = normalizeSearch(text).replace(/[^a-z0-9]+/g, " ");
  return normalizedQuery
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export type ListViewOptions<T> = {
  /** The search as typed; it is normalized before `matches` sees it. An empty search keeps all. */
  query: string;
  matches: (item: T, normalizedQuery: string) => boolean;
  filter?: (item: T) => boolean;
  sort?: (a: T, b: T) => number;
  descending?: boolean;
  /** 1-based; a page beyond the end shows the last one. */
  page?: number;
  pageSize: number;
};

export type ListView<T> = {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
  /** 1-based position of the first and last rows shown, 0 when the list is empty. */
  first: number;
  last: number;
};

/** What a back-office list shows: search, filter, sort, then one page. */
export function viewList<T>(items: readonly T[], options: ListViewOptions<T>): ListView<T> {
  const query = normalizeSearch(options.query.slice(0, SEARCH_MAX_LENGTH));
  let kept = items.filter(
    (item) => (!options.filter || options.filter(item)) && (!query || options.matches(item, query)),
  );
  if (options.sort) {
    const sort = options.sort;
    const sign = options.descending ? -1 : 1;
    kept = [...kept].sort((a, b) => sign * sort(a, b));
  }
  const pageCount = Math.max(1, Math.ceil(kept.length / options.pageSize));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1)), pageCount);
  const start = (page - 1) * options.pageSize;
  const rows = kept.slice(start, start + options.pageSize);
  return {
    rows,
    total: kept.length,
    page,
    pageCount,
    first: rows.length ? start + 1 : 0,
    last: start + rows.length,
  };
}
