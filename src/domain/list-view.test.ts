import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { normalizeSearch, viewList } from "./list-view";

type Row = { id: string; name: string; players: number };
const rows: Row[] = [
  { id: "a", name: "Étoile de Sceaux", players: 3 },
  { id: "b", name: "Athlé Club des Tests", players: 12 },
  { id: "c", name: "Foulées de Fictiville", players: 0 },
];
const base = {
  matches: (row: Row, query: string) => normalizeSearch(row.name).includes(query),
  pageSize: 2,
};

describe("list view", () => {
  it("finds a row whatever the accents and the case", () => {
    const view = viewList(rows, { ...base, query: "etoile" });
    expect(view.rows.map((r) => r.id)).toEqual(["a"]);
    expect(view.total).toBe(1);
  });

  it("keeps only the rows of the chosen filter", () => {
    const view = viewList(rows, { ...base, query: "", filter: (r) => r.players > 0 });
    expect(view.total).toBe(2);
  });

  it("sorts by a column, both ways", () => {
    const sort = (a: Row, b: Row) => a.players - b.players;
    expect(
      viewList(rows, { ...base, query: "", sort, pageSize: 10 }).rows.map((r) => r.id),
    ).toEqual(["c", "a", "b"]);
    expect(
      viewList(rows, { ...base, query: "", sort, descending: true, pageSize: 10 }).rows.map(
        (r) => r.id,
      ),
    ).toEqual(["b", "a", "c"]);
  });

  it("cuts the rows into pages and brings a page beyond the end back to the last one", () => {
    const view = viewList(rows, { ...base, query: "", page: 9 });
    expect(view).toMatchObject({ page: 2, pageCount: 2, first: 3, last: 3, total: 3 });
    expect(view.rows.map((r) => r.id)).toEqual(["c"]);
  });

  it("gives one empty page when nothing matches", () => {
    expect(viewList(rows, { ...base, query: "zzz" })).toMatchObject({
      rows: [],
      page: 1,
      pageCount: 1,
      first: 0,
      last: 0,
      total: 0,
    });
  });

  it("shows every matching row exactly once across the pages", () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat(50), { maxLength: 60 }),
        fc.integer({ min: 1, max: 7 }),
        (values, size) => {
          const items = values.map((players, i) => ({ id: `r${i}`, name: `n${i}`, players }));
          const first = viewList(items, { ...base, query: "", pageSize: size });
          const seen = Array.from(
            { length: first.pageCount },
            (_, i) => viewList(items, { ...base, query: "", pageSize: size, page: i + 1 }).rows,
          ).flat();
          expect(seen.map((r) => r.id).sort()).toEqual(items.map((r) => r.id).sort());
        },
      ),
    );
  });
});
