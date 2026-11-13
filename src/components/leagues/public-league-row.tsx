import type { ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import type { LeagueFamily } from "@/domain/league-families";

import { FamilyBadge } from "./family-badge";
import { leagueSummaryText } from "./league-card";

const text = messages.leagues;

/**
 * A public league of « Découvrir » (#662): name, families, « 12/200 joueurs · 3 compétitions ·
 * mars → sept. 2027 », how full it is, and its actions on the right (join, report) as children.
 */
export function PublicLeagueRow({
  name,
  memberCount,
  maxMembers,
  summary,
  families = [],
  children,
}: {
  name: string;
  memberCount: number;
  maxMembers: number;
  summary: { count: number; start: string | null; end: string | null };
  families?: LeagueFamily[];
  children?: ReactNode;
}) {
  const fill = Math.min(100, Math.round((memberCount / maxMembers) * 100));
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-card p-3.5">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 break-words font-extrabold">{name}</span>
        {families.length > 0 && (
          <span className="block">
            <FamilyBadge families={families} />
          </span>
        )}
        <span className="block text-sm text-muted-foreground">
          {[text.publicPlaces(memberCount, maxMembers), leagueSummaryText(summary)].join(" · ")}
        </span>
        <span
          role="img"
          aria-label={text.fillLabel(memberCount, maxMembers)}
          className="block h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <span className="block h-full rounded-full bg-primary" style={{ width: `${fill}%` }} />
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">{children}</span>
    </div>
  );
}

/** A row-shaped placeholder while the public leagues load. */
export function PublicLeagueRowSkeleton() {
  return (
    <div
      aria-hidden
      className="flex min-h-20 items-center gap-3 rounded-card border border-border bg-card p-3.5 motion-safe:animate-pulse"
    >
      <span className="flex flex-1 flex-col gap-2">
        <span className="h-4 w-2/3 rounded bg-muted" />
        <span className="h-3 w-3/4 rounded bg-muted" />
        <span className="h-1.5 w-full rounded-full bg-muted" />
      </span>
      <span className="h-11 w-24 rounded-full bg-muted" />
    </div>
  );
}
