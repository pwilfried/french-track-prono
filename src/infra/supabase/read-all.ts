type Page<T> = PromiseLike<{ data: T[] | null; error: { code?: string } | null }>;

/** Rows asked per request: the API answers at most `max_rows` (1,000, supabase/config.toml). */
export const PAGE_ROWS = 1000;

/**
 * Reads every row of a query a page at a time (#508): the Supabase API cuts each answer at
 * `max_rows`, so a single request never sees the 1,001st row. `page(from, to)` is the query with
 * `.range(from, to)`; it needs a total order (a unique last sort key), or rows could repeat or go
 * missing between pages. Stops on the first empty page, so a smaller cap than PAGE_ROWS on the
 * server still reads everything.
 */
export async function readAll<T>(
  page: (from: number, to: number) => Page<T>,
  size = PAGE_ROWS,
): Promise<{ data: T[]; error: null } | { data: null; error: { code?: string } }> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + size - 1);
    if (error) return { data: null, error };
    if (!data || data.length === 0) return { data: rows, error: null };
    rows.push(...data);
  }
}
