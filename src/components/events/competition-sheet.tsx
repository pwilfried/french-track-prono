"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { messages } from "@/app/messages.fr";
import type { CompetitionScope, CompetitionVenue } from "@/domain/competition";
import { competitionGroups, searchCompetitions } from "@/domain/competition-search";
import { cn } from "@/lib/utils";

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
 * « Choisir une compétition » (#659): a bottom sheet over the tab, in a modal dialog (the browser
 * keeps the focus inside, Escape closes it), closed by its button or a touch outside. Search by
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
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal?.();
    if (!open && element.open) element.close?.();
  }, [open]);

  const groups = competitionGroups(
    searchCompetitions(competitions, query, scope),
    myLeagueSlugs,
    today,
  );

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        // Handled here so that the browser's own cancel does not close it behind React's back.
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      onClick={(event) => {
        // A touch on the backdrop lands on the dialog itself, outside the sheet.
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-background p-0 text-foreground backdrop:bg-black/50 md:mx-auto md:mb-auto md:max-w-lg md:rounded-3xl"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex flex-col gap-3 border-b border-border px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-display text-xl font-extrabold">
              {text.sheet.title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold"
            >
              {text.sheet.close}
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={text.sheet.search}
            placeholder={text.sheet.search}
            className="min-h-11 w-full rounded-full border border-border bg-card px-4 text-base"
          />
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
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">
          {groups.length === 0 ? (
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
              {text.sheet.none}
            </p>
          ) : (
            groups.map((group) => {
              const label =
                group.kind === "month"
                  ? text.month(group.month)
                  : group.kind === "mine"
                    ? text.sheet.mine
                    : text.sheet.past;
              return (
                <section key={group.month ?? group.kind} className="mb-4 flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </h3>
                  <ul className="flex flex-col gap-1.5">
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
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </div>
    </dialog>
  );
}

function SheetLine({
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
    <Link
      href={href}
      onClick={onPick}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-2xl border-2 px-3 py-2",
        selected ? "border-brand bg-brand-soft" : "border-transparent bg-card",
      )}
    >
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
      {selected && (
        <span className="font-bold text-brand-ink">
          <span aria-hidden="true">✓</span>
          <span className="sr-only">{text.sheet.shown}</span>
        </span>
      )}
    </Link>
  );
}
