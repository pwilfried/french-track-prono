import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { Change } from "@/components/leaderboard/ranking-row";
import type { LeagueFamily } from "@/domain/league-families";
import { cn } from "@/lib/utils";

import { FamilyBadge } from "./family-badge";

const text = messages.leagues;

/** « 12 compétitions · déc. 2026 → avr. 2027 », or « sans compétition » (#662). */
export function leagueSummaryText(summary: {
  count: number;
  start: string | null;
  end: string | null;
}): string {
  if (summary.count === 0) return text.noCompetitionTag;
  return [
    text.competitionCount(summary.count),
    ...(summary.start && summary.end ? [text.period(summary.start, summary.end)] : []),
  ].join(" · ");
}

/** « Privée », « Publique » or « Officielle », next to a league name. */
export function LeagueKindBadge({
  isPublic,
  isOfficial = false,
}: {
  isPublic: boolean;
  isOfficial?: boolean;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
        isPublic ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {isOfficial ? text.officialBadge : isPublic ? text.publicBadge : text.privateBadge}
    </span>
  );
}

/**
 * One of the player's leagues in « Mes ligues », summed up (#662): name on two lines at most, its
 * kind and families, how many competitions over which months (their names stay on the league
 * page), the next one; on the right the player's place out of the players, with its movement since
 * yesterday (#551), or a short note while without points.
 */
export function LeagueCard({
  href,
  name,
  memberCount,
  summary,
  next = null,
  isPublic = false,
  isOfficial = false,
  families = [],
  standing,
}: {
  href: string;
  name: string;
  memberCount: number;
  summary: { count: number; start: string | null; end: string | null };
  /** The competition under way or coming first, with its first day (YYYY-MM-DD). */
  next?: { name: string; startsOn: string } | null;
  isPublic?: boolean;
  isOfficial?: boolean;
  /** The families it is limited to (#613); none: all events, no badge. */
  families?: LeagueFamily[];
  standing: { rank: number; change: number | null } | null;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-card p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start gap-2">
          <span className="line-clamp-2 min-w-0 break-words font-extrabold">{name}</span>
          <LeagueKindBadge isPublic={isPublic} isOfficial={isOfficial} />
        </span>
        {families.length > 0 && (
          <span className="block">
            <FamilyBadge families={families} />
          </span>
        )}
        <span className="block text-sm text-muted-foreground">{leagueSummaryText(summary)}</span>
        {next && (
          <span className="block break-words text-xs font-semibold text-foreground">
            {text.nextCompetition(next.name, next.startsOn)}
          </span>
        )}
      </span>
      {standing ? (
        <span className="shrink-0 text-right">
          <span className="block font-display text-3xl font-extrabold leading-none">
            <span aria-hidden>{text.rank(standing.rank)}</span>
            <span className="sr-only">{text.rankLabel(standing.rank)}</span>
          </span>
          <span className="block text-xs text-muted-foreground">{text.outOf(memberCount)}</span>
          {standing.change !== null && (
            <Change change={standing.change} className="block w-auto text-right" />
          )}
        </span>
      ) : (
        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
          {text.noPointsYet}
          <span className="block">{text.players(memberCount)}</span>
        </span>
      )}
    </Link>
  );
}

/** A card-shaped placeholder while the leagues load. */
export function LeagueCardSkeleton() {
  return (
    <div
      aria-hidden
      className="flex min-h-24 items-center gap-3 rounded-card border border-border bg-card p-3.5 motion-safe:animate-pulse"
    >
      <span className="flex flex-1 flex-col gap-2">
        <span className="h-4 w-2/3 rounded bg-muted" />
        <span className="h-3 w-1/2 rounded bg-muted" />
        <span className="h-3 w-1/3 rounded bg-muted" />
      </span>
      <span className="h-8 w-10 rounded bg-muted" />
    </div>
  );
}
