"use client";

import { useState, type ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import { PUBLIC_LEAGUE_MAX_MEMBERS } from "@/domain/league";
import type { LeagueFamily } from "@/domain/league-families";
import {
  discoverLeagues,
  leagueFamiliesIn,
  PUBLIC_LEAGUE_SORTS,
  type PublicLeagueSort,
} from "@/domain/league-list";
import { cn } from "@/lib/utils";

import { PublicLeagueRow } from "./public-league-row";

const text = messages.leagues;

export type DiscoverableRow = {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
  families?: LeagueFamily[];
  summary: { count: number; start: string | null; end: string | null };
  /** Its join and report forms. */
  actions?: ReactNode;
};

/**
 * The public leagues of « Découvrir » (#662): search by name, filter by family (those present),
 * sort (places left by default), then the rows. `notice` when there is no league to join at all.
 */
export function DiscoverLeagues({
  leagues,
  notice,
}: {
  leagues: DiscoverableRow[];
  notice: string;
}) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<LeagueFamily | "all">("all");
  const [sort, setSort] = useState<PublicLeagueSort>("places");

  if (leagues.length === 0) {
    return <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{notice}</p>;
  }
  const families = leagueFamiliesIn(leagues);
  const shown = discoverLeagues(leagues, { query, family, sort });
  const chip = (value: LeagueFamily | "all", label: string) => (
    <button
      key={value}
      type="button"
      aria-pressed={family === value}
      onClick={() => setFamily(value)}
      className={cn(
        "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold",
        family === value
          ? "bg-brand text-brand-foreground dark:bg-secondary dark:text-secondary-foreground"
          : "border border-border bg-background text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={text.searchPlaceholder}
        aria-label={text.searchLabel}
        autoComplete="off"
        className="min-h-11 rounded-full border border-border bg-background px-4 text-base"
      />
      {families.length > 0 && (
        <div
          role="group"
          aria-label={text.familyFilterLabel}
          className="-mx-4 flex gap-2 overflow-x-auto px-4"
        >
          {chip("all", text.allFamilies)}
          {families.map((f) => chip(f, text.family[f]))}
        </div>
      )}
      <label className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        {text.sortLabel}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as PublicLeagueSort)}
          className="min-h-11 rounded-full border border-border bg-background px-3 font-semibold text-foreground"
        >
          {PUBLIC_LEAGUE_SORTS.map((s) => (
            <option key={s} value={s}>
              {text.sorts[s]}
            </option>
          ))}
        </select>
      </label>
      {shown.length === 0 ? (
        <p role="status" className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
          {text.noMatch}
        </p>
      ) : (
        <ul aria-label={text.publicTitle} className="flex flex-col gap-2">
          {shown.map((league) => (
            <li key={league.id}>
              <PublicLeagueRow
                name={league.name}
                memberCount={league.memberCount}
                maxMembers={PUBLIC_LEAGUE_MAX_MEMBERS}
                summary={league.summary}
                families={league.families}
              >
                {league.actions}
              </PublicLeagueRow>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
