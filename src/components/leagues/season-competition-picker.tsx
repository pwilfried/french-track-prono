"use client";

import { memo, useCallback, useMemo, useState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { ChipStatus } from "@/components/ui/chip-status";
import type { CompetitionScope, CompetitionVenue } from "@/domain/competition";
import { SEARCH_MAX_LENGTH } from "@/domain/list-view";
import { MANAGER_LEAGUE_MAX, seasonAdvice } from "@/domain/manager-league";
import {
  filterCompetitions,
  groupByMonth,
  isSearching,
  levelsOf,
  NO_FILTERS,
  quickSelections,
  type PickableCompetition,
  type PickerFilters,
  type QuickSelection,
} from "@/domain/season-picker";
import { cn } from "@/lib/utils";

const text = messages.seasonPicker;

/** How many months are open when the picker shows up. */
const OPEN_MONTHS = 2;

const chip = (active: boolean) =>
  cn(
    "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold",
    active
      ? "bg-brand text-brand-foreground dark:bg-secondary dark:text-secondary-foreground"
      : "border border-border bg-background text-foreground",
  );
const smallLabel = "text-xs font-bold uppercase tracking-wide text-muted-foreground";

const quickName = (selection: QuickSelection) =>
  selection.kind === "level" ? text.level(selection.level) : text.quick[selection.kind];

const sameIds = (ids: ReadonlySet<string>, selection: QuickSelection) =>
  ids.size === selection.ids.length && selection.ids.every((id) => ids.has(id));

/** One choice among a few, as pills: « Toutes · Internationales · France ». */
function Pills<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: V | null; label: string }[];
  value: V | null;
  onChange: (value: V | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value ?? "all"}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={chip(value === option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A competition of the list; memoised so that ticking one does not draw the others again. */
const CompetitionRow = memo(function CompetitionRow({
  competition,
  checked,
  onToggle,
}: {
  competition: PickableCompetition;
  checked: boolean;
  onToggle: (id: string, on: boolean) => void;
}) {
  return (
    <li>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-2 has-checked:border-primary">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onToggle(competition.id, event.target.checked)}
          className="size-5 shrink-0 accent-primary"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="break-words font-semibold">
            {text.option(competition.name, text.day(competition.firstEventAt))}
          </span>
          {competition.city && (
            <span className="break-words text-sm text-muted-foreground">{competition.city}</span>
          )}
        </span>
        {competition.venue === "indoor" && <ChipStatus tone="brand">{text.indoorChip}</ChipStatus>}
        {competition.scope === "france" && <ChipStatus tone="gold">{text.franceChip}</ChipStatus>}
      </label>
    </li>
  );
});

/** What the sticky bar says: the count, and for the Manager the format and how to land exactly. */
function Summary({
  count,
  minimum,
  withFormat,
}: {
  count: number;
  minimum: number;
  withFormat: boolean;
}) {
  if (!withFormat) {
    return (
      <p className="font-bold">
        {text.chosen(count)}
        {count < minimum && (
          <span className="block text-sm font-normal opacity-85">{text.atLeast(minimum)}</span>
        )}
      </p>
    );
  }
  const advice = seasonAdvice(count);
  if (advice.kind === "too-few") {
    return <p className="font-bold">{messages.manager.seasonTooFew(count)}</p>;
  }
  const { format, next, trim } = advice;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-bold">
        {messages.manager.seasonFormat(count, format.players, format.duelDays, format.bonusDays)}
      </p>
      <p className="text-sm opacity-85">
        {next
          ? messages.manager.seasonMore(next.missing, next.players)
          : messages.manager.seasonCap(MANAGER_LEAGUE_MAX)}
        {trim > 0 && ` ${messages.manager.seasonTrim(trim)}`}
      </p>
    </div>
  );
}

/**
 * The competitions of a league (#663), Manager or predictions: quick selections built from the
 * data, a search with combinable filters, the list by month (the first two open), and a bar with
 * the count (for the Manager: the players and matchdays, and how to land exactly) and the
 * submit button, disabled under the minimum. The bar sticks above the navigation only once a
 * competition is ticked, so that, empty, it covers nothing (#804). Only competitions not finished are given. The ticked
 * ones are sent as hidden fields named `name`, so a closed month still counts.
 */
export function SeasonCompetitionPicker({
  competitions,
  chosen,
  name,
  minimum,
  withFormat = false,
  label,
  hint,
  empty,
  submitLabel,
  pendingLabel,
  blocked = false,
}: {
  competitions: PickableCompetition[];
  chosen: readonly string[];
  /** The name of the hidden fields, one per ticked competition. */
  name: string;
  /** Below it, the submit button is disabled: 6 for the Manager, 1 for a predictions league. */
  minimum: number;
  /** The Manager: « N compétitions → J joueurs · D journées (+ B bonus) » and the advice. */
  withFormat?: boolean;
  label: string;
  hint: string;
  /** Shown when there are fewer competitions than the minimum. */
  empty: string;
  submitLabel: string;
  pendingLabel: string;
  /** Another part of the form is not ready yet (a league's families, #613): the button waits. */
  blocked?: boolean;
}) {
  const [ids, setIds] = useState(() => new Set(chosen));
  const [filters, setFilters] = useState<PickerFilters>(NO_FILTERS);
  const quick = useMemo(() => quickSelections(competitions), [competitions]);
  const levels = useMemo(() => levelsOf(competitions), [competitions]);
  const [openMonths, setOpenMonths] = useState(
    () =>
      new Set(
        groupByMonth(competitions)
          .slice(0, OPEN_MONTHS)
          .map((g) => g.month),
      ),
  );
  const shown = useMemo(
    () => filterCompetitions(competitions, filters, ids),
    [competitions, filters, ids],
  );
  const months = useMemo(() => groupByMonth(shown), [shown]);
  const searching = isSearching(filters);
  const filtered = shown.length !== competitions.length;

  const toggle = useCallback(
    (id: string, on: boolean) =>
      setIds((current) => {
        const next = new Set(current);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );
  const setShown = (on: boolean) =>
    setIds((current) => {
      const next = new Set(current);
      for (const c of shown) {
        if (on) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });
  const toggleMonth = (month: string) =>
    setOpenMonths((current) => {
      const next = new Set(current);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  const set = <K extends keyof PickerFilters>(key: K, value: PickerFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </legend>
      <p className="text-sm text-muted-foreground">{hint}</p>
      {[...ids].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {competitions.length < minimum && (
        <p className="rounded-2xl bg-muted px-3.5 py-3 text-sm">{empty}</p>
      )}

      {quick.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className={smallLabel}>{text.quickTitle}</p>
          <div
            role="group"
            aria-label={text.quickTitle}
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
          >
            {quick.map((selection) => {
              const active = sameIds(ids, selection);
              return (
                <button
                  key={selection.kind === "level" ? `level-${selection.level}` : selection.kind}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setIds(new Set(selection.ids))}
                  className={chip(active)}
                >
                  {text.quickLabel(quickName(selection), selection.ids.length)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {competitions.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-3">
          <label className="flex flex-col gap-1">
            <span className="sr-only">{text.searchLabel}</span>
            <input
              type="search"
              value={filters.query}
              onChange={(event) => set("query", event.target.value)}
              placeholder={text.searchPlaceholder}
              aria-label={text.searchLabel}
              maxLength={SEARCH_MAX_LENGTH}
              autoComplete="off"
              className="min-h-11 rounded-xl border-2 border-border bg-background px-3 text-base focus-visible:border-primary focus-visible:outline-none"
            />
          </label>
          <Pills<CompetitionScope>
            label={text.scopeLabel}
            value={filters.scope}
            onChange={(value) => set("scope", value)}
            options={[
              { value: null, label: text.scope.all },
              { value: "international", label: text.scope.international },
              { value: "france", label: text.scope.france },
            ]}
          />
          <Pills<CompetitionVenue>
            label={text.venueLabel}
            value={filters.venue}
            onChange={(value) => set("venue", value)}
            options={[
              { value: null, label: text.venue.all },
              { value: "indoor", label: text.venue.indoor },
              { value: "outdoor", label: text.venue.outdoor },
            ]}
          />
          {levels.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="sr-only">{text.levelLabel}</span>
              <select
                value={filters.level ?? ""}
                onChange={(event) => set("level", event.target.value || null)}
                aria-label={text.levelLabel}
                className="min-h-11 rounded-xl border-2 border-border bg-background px-2.5 text-base"
              >
                <option value="">{text.levelAll}</option>
                {levels.map((level) => (
                  <option key={level} value={level}>
                    {text.level(level)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={filters.onlyChosen}
              onChange={(event) => set("onlyChosen", event.target.checked)}
              className="size-5 shrink-0 accent-primary"
            />
            {text.onlyChosen}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <p role="status" className="mr-auto text-sm text-muted-foreground">
              {text.shown(shown.length, competitions.length)}
            </p>
            <button
              type="button"
              onClick={() => setShown(true)}
              disabled={shown.length === 0}
              className="inline-flex min-h-11 items-center px-2 text-sm font-bold underline underline-offset-4 disabled:opacity-50"
            >
              {text.checkShown}
            </button>
            <button
              type="button"
              onClick={() => setShown(false)}
              disabled={shown.length === 0}
              className="inline-flex min-h-11 items-center px-2 text-sm font-bold underline underline-offset-4 disabled:opacity-50"
            >
              {text.uncheckShown}
            </button>
          </div>
        </div>
      )}

      {competitions.length > 0 && months.length === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-2xl bg-muted px-3.5 py-3 text-sm">
          <p>{text.noMatch}</p>
          {filtered && (
            <button
              type="button"
              onClick={() => setFilters(NO_FILTERS)}
              className="inline-flex min-h-11 items-center font-bold underline underline-offset-4"
            >
              {text.resetFilters}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {months.map((group) => {
          const open = searching || openMonths.has(group.month);
          const ticked = group.competitions.filter((c) => ids.has(c.id)).length;
          const monthName = text.month(group.month);
          const listId = `season-month-${group.month}`;
          return (
            <section key={group.month} className="flex flex-col gap-1.5">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                aria-label={text.monthToggle(monthName, ticked, group.competitions.length)}
                onClick={() => toggleMonth(group.month)}
                disabled={searching}
                className="flex min-h-11 items-center gap-2 rounded-xl px-1 text-left"
              >
                <span
                  aria-hidden
                  className={cn(
                    "transition-transform motion-reduce:transition-none",
                    open && "rotate-90",
                  )}
                >
                  ›
                </span>
                <span className="flex-1 font-bold capitalize">{monthName}</span>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {text.monthCount(ticked, group.competitions.length)}
                </span>
              </button>
              {open && (
                <ul id={listId} className="flex flex-col gap-1.5">
                  {group.competitions.map((c) => (
                    <CompetitionRow
                      key={c.id}
                      competition={c}
                      checked={ids.has(c.id)}
                      onToggle={toggle}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div
        className={cn(
          "flex flex-col gap-2 rounded-2xl bg-foreground p-3 text-background shadow-lg",
          ids.size > 0 && "sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 md:bottom-3",
        )}
      >
        <div role="status" aria-live="polite">
          <Summary count={ids.size} minimum={minimum} withFormat={withFormat} />
        </div>
        <SubmitButton pendingLabel={pendingLabel} disabled={blocked || ids.size < minimum}>
          {submitLabel}
        </SubmitButton>
      </div>
    </fieldset>
  );
}

/** While the competitions load. */
export function SeasonCompetitionPickerSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{text.loading}</span>
      <div className="flex gap-2">
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            className="h-11 w-32 animate-pulse rounded-full bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-card bg-muted motion-reduce:animate-none" />
      {[0, 1, 2, 3].map((n) => (
        <div
          key={n}
          className="h-14 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
