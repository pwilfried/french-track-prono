"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import { normalizeSearch, viewList } from "@/domain/list-view";
import { cn } from "@/lib/utils";

const text = messages.adminList;

export type ListColumn<T> = {
  key: string;
  label: string;
  cell: (item: T) => ReactNode;
  /** Makes the column header a sort button. */
  sort?: (a: T, b: T) => number;
  /** Numbers are right-aligned. */
  numeric?: boolean;
  /** Left out of the mobile cards (the first column is the card title). */
  hideOnCard?: boolean;
};

export type ListFilter<T> = { key: string; label: string; test: (item: T) => boolean };

/** What an action tells the admin: a short message, with Annuler when it can be undone. */
export type ListFeedback =
  { message: string; undo?: () => Promise<void> | void } | { error: string };

export type ListConfirm = { title: string; body: string; submit: string };

export type BulkAction = {
  key: string;
  label: string;
  danger?: boolean;
  /** A real confirmation window before running, for deletions. */
  confirm?: (count: number) => ListConfirm;
  run: (ids: string[]) => Promise<ListFeedback>;
};

export type DetailContext = {
  close: () => void;
  notify: (feedback: ListFeedback) => void;
  /** Asks for confirmation, then runs the action and shows its message. */
  confirm: (confirm: ListConfirm, run: () => Promise<ListFeedback>) => void;
};

export type AdminListProps<T> = {
  items: readonly T[];
  getId: (item: T) => string;
  /** The name read by screen readers on the checkbox and the open button. */
  getLabel: (item: T) => string;
  columns: ListColumn<T>[];
  /** Searched text of a row; compared without accents or case. */
  searchText: (item: T) => string;
  searchLabel: string;
  searchPlaceholder?: string;
  filters?: ListFilter<T>[];
  defaultFilter?: string;
  bulkActions?: BulkAction[];
  renderDetail?: (item: T, context: DetailContext) => ReactNode;
  pageSize?: number;
  status?: "ready" | "loading" | "error";
  errorText?: string;
  emptyText?: string;
  /** The accessible name of the table and of the card list. */
  label: string;
};

/**
 * The back-office list (#380): search, filter chips with counts, sort, pages, a table on a
 * computer and cards on a phone, multiple selection with grouped actions, and a detail panel.
 */
export function AdminList<T>(props: AdminListProps<T>) {
  const {
    items,
    getId,
    getLabel,
    columns,
    filters = [],
    bulkActions = [],
    pageSize = 25,
    status = "ready",
  } = props;
  const [query, setQuery] = useState("");
  const [filterKey, setFilterKey] = useState<string | null>(
    props.defaultFilter ?? filters[0]?.key ?? null,
  );
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ListFeedback | null>(null);
  const [pending, setPending] = useState<{
    confirm: ListConfirm;
    run: () => Promise<ListFeedback>;
  } | null>(null);

  const filter = filters.find((f) => f.key === filterKey);
  const column = columns.find((c) => c.key === sortKey);
  const view = useMemo(
    () =>
      viewList(items, {
        query,
        matches: (item, q) => normalizeSearch(props.searchText(item)).includes(q),
        filter: filter?.test,
        sort: column?.sort,
        descending,
        page,
        pageSize,
      }),
    [items, query, filter, column, descending, page, pageSize, props],
  );
  const open = openId ? items.find((item) => getId(item) === openId) : undefined;

  // Selected rows that left the list are forgotten.
  const ids = useMemo(() => new Set(items.map(getId)), [items, getId]);
  const chosen = [...selected].filter((id) => ids.has(id));

  const notify = useCallback((next: ListFeedback) => setFeedback(next), []);
  const run = useCallback(
    async (action: () => Promise<ListFeedback>) => {
      try {
        notify(await action());
      } catch {
        notify({ error: text.failed });
      }
    },
    [notify],
  );
  const ask = useCallback(
    (confirm: ListConfirm, action: () => Promise<ListFeedback>) =>
      setPending({ confirm, run: action }),
    [],
  );

  const runBulk = (action: BulkAction) => {
    const go = async () => {
      const outcome = await action.run(chosen);
      setSelected(new Set());
      return outcome;
    };
    if (action.confirm) ask(action.confirm(chosen.length), go);
    else void run(go);
  };

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pageIds = view.rows.map(getId);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of pageIds) {
        if (allOnPage) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  const sortBy = (key: string) => {
    if (sortKey === key) setDescending((d) => !d);
    else {
      setSortKey(key);
      setDescending(false);
    }
    setPage(1);
  };

  const context: DetailContext = { close: () => setOpenId(null), notify, confirm: ask };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <label className="flex min-h-11 items-center gap-2 rounded-2xl border-2 border-border bg-card px-3.5 focus-within:border-brand">
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="shrink-0 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="sr-only">{props.searchLabel}</span>
          <input
            type="search"
            value={query}
            placeholder={props.searchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        {filters.length > 0 && (
          <div role="group" aria-label={text.filters} className="flex flex-wrap gap-2">
            {filters.map((f) => {
              const active = f.key === filterKey;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setFilterKey(active && filters.length > 1 ? null : f.key);
                    setPage(1);
                  }}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border-2 px-3.5 text-sm font-semibold",
                    active
                      ? "border-brand bg-brand text-brand-foreground dark:border-secondary"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  {f.label} · {items.filter(f.test).length}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {chosen.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-brand-ink px-4 py-2 text-brand-foreground dark:bg-brand">
          <span className="mr-auto font-bold" aria-live="polite">
            {text.selected(chosen.length)}
          </span>
          {bulkActions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => runBulk(action)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold",
                action.danger ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
              )}
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline"
          >
            {text.clearSelection}
          </button>
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {status === "loading" ? (
            <div role="status" className="flex flex-col gap-2">
              <span className="sr-only">{text.loading}</span>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className="h-14 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
                />
              ))}
            </div>
          ) : status === "error" ? (
            <p
              role="alert"
              className="rounded-2xl bg-muted px-4 py-3 font-semibold text-accent-text"
            >
              {props.errorText ?? text.failed}
            </p>
          ) : view.total === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border px-4 py-6 text-center text-muted-foreground">
              {query ? text.noMatch : (props.emptyText ?? text.empty)}
            </p>
          ) : (
            <>
              <table
                aria-label={props.label}
                className="hidden w-full border-separate border-spacing-0 overflow-hidden rounded-2xl border border-border bg-card md:table"
              >
                <thead>
                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {bulkActions.length > 0 && (
                      <th scope="col" className="w-12 border-b border-border px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allOnPage}
                          onChange={toggleAll}
                          aria-label={text.selectAll}
                          className="size-5 accent-brand"
                        />
                      </th>
                    )}
                    {columns.map((c) => (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={
                          sortKey === c.key ? (descending ? "descending" : "ascending") : undefined
                        }
                        className={cn(
                          "border-b border-border px-3 py-2",
                          c.numeric && "text-right",
                        )}
                      >
                        {c.sort ? (
                          <button
                            type="button"
                            onClick={() => sortBy(c.key)}
                            className="inline-flex min-h-11 items-center gap-1 uppercase"
                          >
                            {c.label}
                            <span aria-hidden="true">
                              {sortKey === c.key ? (descending ? "▼" : "▲") : ""}
                            </span>
                          </button>
                        ) : (
                          c.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((item) => {
                    const id = getId(item);
                    return (
                      <tr
                        key={id}
                        className={cn(
                          openId === id && "bg-brand-soft",
                          selected.has(id) && "bg-brand-soft/60",
                        )}
                      >
                        {bulkActions.length > 0 && (
                          <td className="border-b border-border px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selected.has(id)}
                              onChange={() => toggle(id)}
                              aria-label={text.select(getLabel(item))}
                              className="size-5 accent-brand"
                            />
                          </td>
                        )}
                        {columns.map((c, index) => (
                          <td
                            key={c.key}
                            className={cn(
                              "border-b border-border px-3 py-2",
                              c.numeric && "text-right font-mono",
                            )}
                          >
                            {index === 0 && props.renderDetail ? (
                              <button
                                type="button"
                                onClick={() => setOpenId(id)}
                                aria-label={text.open(getLabel(item))}
                                className="min-h-11 text-left font-bold hover:underline"
                              >
                                {c.cell(item)}
                              </button>
                            ) : (
                              c.cell(item)
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <ul aria-label={props.label} className="flex flex-col gap-2 md:hidden">
                {view.rows.map((item) => {
                  const id = getId(item);
                  const [first, ...rest] = columns;
                  return (
                    <li
                      key={id}
                      className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3"
                    >
                      {bulkActions.length > 0 && (
                        <input
                          type="checkbox"
                          checked={selected.has(id)}
                          onChange={() => toggle(id)}
                          aria-label={text.select(getLabel(item))}
                          className="mt-3 size-5 shrink-0 accent-brand"
                        />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {props.renderDetail ? (
                          <button
                            type="button"
                            onClick={() => setOpenId(id)}
                            aria-label={text.open(getLabel(item))}
                            className="min-h-11 text-left font-bold"
                          >
                            {first.cell(item)}
                          </button>
                        ) : (
                          <span className="font-bold">{first.cell(item)}</span>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          {rest
                            .filter((c) => !c.hideOnCard)
                            .map((c) => (
                              <span key={c.key}>{c.cell(item)}</span>
                            ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{text.range(view.first, view.last, view.total)}</span>
                {view.pageCount > 1 && (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={view.page === 1}
                      onClick={() => setPage(view.page - 1)}
                      aria-label={text.previous}
                      className="inline-flex size-11 items-center justify-center rounded-full font-bold disabled:opacity-40"
                    >
                      ‹
                    </button>
                    <span>{text.page(view.page, view.pageCount)}</span>
                    <button
                      type="button"
                      disabled={view.page === view.pageCount}
                      onClick={() => setPage(view.page + 1)}
                      aria-label={text.next}
                      className="inline-flex size-11 items-center justify-center rounded-full font-bold disabled:opacity-40"
                    >
                      ›
                    </button>
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {open && props.renderDetail && (
          <DetailPanel title={getLabel(open)} onClose={() => setOpenId(null)}>
            {props.renderDetail(open, context)}
          </DetailPanel>
        )}
      </div>

      <ConfirmDialog
        pending={pending?.confirm ?? null}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending?.run;
          setPending(null);
          if (action) void run(action);
        }}
      />
      <Toast feedback={feedback} onDone={() => setFeedback(null)} run={run} />
    </div>
  );
}

/** Right of the list on a computer, full screen on a phone; Échap closes it. */
function DetailPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside
      aria-label={title}
      className="fixed inset-0 z-40 flex flex-col gap-4 overflow-y-auto bg-background p-4 md:sticky md:top-4 md:z-auto md:w-96 md:shrink-0 md:rounded-2xl md:border md:border-border md:bg-card md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold leading-tight">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={messages.adminList.close}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-border font-bold"
        >
          ✕
        </button>
      </div>
      {children}
    </aside>
  );
}

/** A real confirmation window (`<dialog>`), for actions that cannot be undone. */
function ConfirmDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: ListConfirm | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal?.();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      aria-labelledby="admin-list-confirm"
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-3xl bg-card p-6 text-foreground backdrop:bg-black/50"
    >
      {pending && (
        <div className="flex flex-col gap-4">
          <h2 id="admin-list-confirm" className="font-display text-2xl font-extrabold">
            {pending.title}
          </h2>
          <p>{pending.body}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              autoFocus
              className="inline-flex min-h-11 items-center rounded-full border-2 border-border px-4 font-bold"
            >
              {messages.adminList.cancel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 font-bold text-primary-foreground"
            >
              {pending.submit}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** The message at the bottom of the screen, with Annuler when the action can be undone. */
function Toast({
  feedback,
  onDone,
  run,
}: {
  feedback: ListFeedback | null;
  onDone: () => void;
  run: (action: () => Promise<ListFeedback>) => Promise<void>;
}) {
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(timer);
  }, [feedback, onDone]);
  const error = feedback && "error" in feedback;
  return (
    <div
      role={error ? "alert" : "status"}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]"
    >
      {feedback && (
        <div
          className={cn(
            "pointer-events-auto flex max-w-md items-center gap-4 rounded-2xl px-4 py-3 font-semibold shadow-lg",
            error
              ? "bg-primary text-primary-foreground"
              : "bg-brand-ink text-brand-foreground dark:bg-brand",
          )}
        >
          <span>{"error" in feedback ? feedback.error : feedback.message}</span>
          {"undo" in feedback && feedback.undo && (
            <button
              type="button"
              onClick={() => {
                const undo = feedback.undo;
                onDone();
                if (undo)
                  void run(async () => {
                    await undo();
                    return { message: messages.adminList.undone };
                  });
              }}
              className="inline-flex min-h-11 items-center font-bold text-secondary underline"
            >
              {messages.adminList.undo}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
