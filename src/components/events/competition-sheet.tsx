"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import type { CompetitionScope, CompetitionVenue } from "@/domain/competition";
import { competitionGroups, searchCompetitions } from "@/domain/competition-search";
import { SEARCH_MAX_LENGTH } from "@/domain/list-view";
import { cn } from "@/lib/utils";

import { BottomSheet } from "../ui/bottom-sheet";
import { ChipStatus } from "../ui/chip-status";
import { DateTile } from "./date-tile";
import { VenueChip } from "./venue-chip";

const text = messages.competitions;

/** What the head card and the sheet show of a competition. */
export type SheetCompetition = {
  slug: string;
  name: string;
  city: string | null;
  scope: CompetitionScope;
  venue: CompetitionVenue;
  startsOn: string;
  endsOn: string;
  /** The finals: the events players predict. None yet: « programme à venir ». */
  finals: number;
};

type ScopeFilter = CompetitionScope | "all";
const SCOPE_FILTERS: ScopeFilter[] = ["all", "international", "france"];

/**
 * « Choisir une compétition » (#659): a bottom sheet over the tab (`BottomSheet`). Search by
 * name or city, filter by kind, then my leagues' competitions and the others by month; the one
 * shown is ticked. Each line is a link (`hrefOf`), so the page reloads on the competition chosen.
 */
export function CompetitionSheet({
  open,
  onClose,
  competitions,
  myLeagueSlugs,
  selected,
  today,
  hrefOf = (slug) => `/competitions?competition=${encodeURIComponent(slug)}`,
}: {
  open: boolean;
  onClose: () => void;
  competitions: SheetCompetition[];
  myLeagueSlugs: string[];
  selected: string;
  /** YYYY-MM-DD: the competitions over before it go to « Terminées ». */
  today: string;
  hrefOf?: (slug: string) => string;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("all");

  const groups = competitionGroups(
    searchCompetitions(competitions, query, scope),
    myLeagueSlugs,
    today,
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={text.sheet.title}
      header={
        <>
          <SheetSearch value={query} onChange={setQuery} />
          <div
            role="radiogroup"
            aria-label={text.sheet.scopeLabel}
            className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1"
          >
            {SCOPE_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={s === scope}
                onClick={() => setScope(s)}
                className={cn(
                  "min-h-11 rounded-full text-sm font-semibold",
                  s === scope ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {text.sheet.scope[s]}
              </button>
            ))}
          </div>
        </>
      }
    >
      {groups.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.sheet.none}</p>
      ) : (
        groups.map((group) => (
          <SheetGroup
            key={group.month ?? group.kind}
            label={
              group.kind === "month"
                ? text.month(group.month)
                : group.kind === "mine"
                  ? text.sheet.mine
                  : text.sheet.past
            }
          >
            {group.competitions.map((c) => (
              <li key={c.slug}>
                <SheetLine
                  competition={c}
                  href={hrefOf(c.slug)}
                  selected={c.slug === selected}
                  onPick={onClose}
                />
              </li>
            ))}
          </SheetGroup>
        ))
      )}
    </BottomSheet>
  );
}

/** The search field of a sheet: by competition name or city. */
export function SheetSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={text.sheet.search}
      placeholder={text.sheet.search}
      maxLength={SEARCH_MAX_LENGTH}
      autoComplete="off"
      className="min-h-11 w-full rounded-full border border-border bg-card px-4 text-base"
    />
  );
}

/** A titled group of lines in a sheet. */
export function SheetGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mb-4 flex flex-col gap-1.5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</h3>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </section>
  );
}

/** A line of a sheet, ticked when it is the one shown (`aria-current`). */
export function SheetLink({
  href,
  selected,
  onPick,
  children,
}: {
  href: string;
  selected: boolean;
  onPick: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onPick}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-2xl border-2 px-3 py-2",
        selected ? "border-brand bg-brand-soft" : "border-transparent bg-card",
      )}
    >
      {children}
      {selected && (
        <span className="font-bold text-brand-ink">
          <span aria-hidden="true">✓</span>
          <span className="sr-only">{text.sheet.shown}</span>
        </span>
      )}
    </Link>
  );
}

/** A competition in a sheet: its first day, name, city, venue and number of events. */
export function SheetLine({
  competition: c,
  href,
  selected,
  onPick,
}: {
  competition: SheetCompetition;
  href: string;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <SheetLink href={href} selected={selected} onPick={onPick}>
      <DateTile date={c.startsOn} className="size-11" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold leading-tight [overflow-wrap:anywhere]">{c.name}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {c.city && <span>{c.city}</span>}
          <VenueChip venue={c.venue} className="py-0.5" />
          {c.scope === "france" && (
            <ChipStatus tone="neutral" className="py-0.5">
              {text.sheet.france}
            </ChipStatus>
          )}
          <span>{c.finals > 0 ? messages.start.events(c.finals) : text.noProgram}</span>
        </span>
      </span>
    </SheetLink>
  );
}
