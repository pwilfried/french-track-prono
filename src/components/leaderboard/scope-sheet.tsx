"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { rankingScopeGroups } from "@/domain/competition-search";
import { cn } from "@/lib/utils";

import {
  SheetGroup,
  SheetLine,
  SheetLink,
  SheetSearch,
  type SheetCompetition,
} from "../events/competition-sheet";
import { BottomSheet } from "../ui/bottom-sheet";
import { segmentSurface, segmentedTrack } from "../ui/view-tabs";
import { rankingHref } from "./ranking-href";

const text = messages.ranking.sheet;

/** A league of the player, as the scope sheet lists it. */
export type ScopeLeague = {
  id: string;
  name: string;
  memberCount: number;
  /** The player's rank in it; null while they have no points. */
  rank: number | null;
  competitions: number;
};

export type ScopeTab = "competitions" | "leagues";

/**
 * « Choisir le classement » (#661), in the bottom sheet of #659. « Saison ou compétition »: a
 * search, « Toute la saison » first, then the competitions in progress and the finished ones (a
 * coming one has no ranking yet). « Mes ligues »: each league with my rank and its number of
 * players, then « Créer ou rejoindre une ligue ». The ranking shown is ticked; each line is a link.
 */
export function ScopeSheet({
  open,
  onClose,
  tab: initialTab,
  competitions,
  competition,
  seasonLabel,
  today,
  leagues,
  league,
}: {
  open: boolean;
  onClose: () => void;
  tab: ScopeTab;
  competitions: SheetCompetition[];
  /** The competition shown in « Général »; null for the whole season, undefined in another view. */
  competition?: string | null;
  seasonLabel: string;
  /** YYYY-MM-DD. */
  today: string;
  /** The player's leagues; absent for a visitor (no « Mes ligues » tab). */
  leagues?: ScopeLeague[];
  league?: string;
}) {
  const [tab, setTab] = useState<ScopeTab>(initialTab);
  const [query, setQuery] = useState("");
  const id = useId();
  const tabs: ScopeTab[] = leagues ? ["competitions", "leagues"] : ["competitions"];
  const { live, past } = rankingScopeGroups(competitions, query, today);
  const competitionLine = (c: SheetCompetition) => (
    <li key={c.slug}>
      <SheetLine
        competition={c}
        href={rankingHref("general", { competition: c.slug })}
        selected={c.slug === competition}
        onPick={onClose}
      />
    </li>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={text.title}
      header={
        <>
          {tabs.length > 1 && (
            <div
              role="tablist"
              aria-label={text.tabsLabel}
              className={cn(segmentedTrack, "grid-cols-2")}
            >
              {tabs.map((t) => (
                <button
                  key={t}
                  id={`${id}-${t}`}
                  type="button"
                  role="tab"
                  aria-selected={t === tab}
                  aria-controls={`${id}-panel`}
                  onClick={() => setTab(t)}
                  className={cn(
                    "min-h-11 rounded-full px-2 text-sm font-semibold",
                    segmentSurface(t === tab),
                  )}
                >
                  {text.tabs[t]}
                </button>
              ))}
            </div>
          )}
          {tab === "competitions" && <SheetSearch value={query} onChange={setQuery} />}
        </>
      }
    >
      <div
        id={`${id}-panel`}
        role={tabs.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={tabs.length > 1 ? `${id}-${tab}` : undefined}
      >
        {tab === "competitions" ? (
          <>
            {!query.trim() && (
              <ul className="mb-4 flex flex-col gap-1.5">
                <li>
                  <SheetLink
                    href={rankingHref("general")}
                    selected={competition === null}
                    onPick={onClose}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-bold leading-tight">{seasonLabel}</span>
                      <span className="text-sm text-muted-foreground">{text.allSeason}</span>
                    </span>
                  </SheetLink>
                </li>
              </ul>
            )}
            {live.length > 0 && (
              <SheetGroup label={text.live}>{live.map(competitionLine)}</SheetGroup>
            )}
            {past.length > 0 && (
              <SheetGroup label={text.past}>{past.map(competitionLine)}</SheetGroup>
            )}
            {query.trim() && live.length === 0 && past.length === 0 && (
              <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.none}</p>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {leagues && leagues.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {leagues.map((l) => (
                  <li key={l.id}>
                    <SheetLink
                      href={rankingHref("ligue", { ligue: l.id })}
                      selected={l.id === league}
                      onPick={onClose}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-bold leading-tight [overflow-wrap:anywhere]">
                          {l.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {text.leagueRank(l.rank, l.memberCount)} ·{" "}
                          {text.competitions(l.competitions)}
                        </span>
                      </span>
                    </SheetLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                {text.noLeague}
              </p>
            )}
            <Link
              href="/ligues"
              onClick={onClose}
              className={`${buttonVariants({ variant: "outline" })} w-full`}
            >
              {text.createOrJoin}
            </Link>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
