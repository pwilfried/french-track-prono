import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { Change } from "@/components/leaderboard/ranking-row";
import type { LeagueFamily } from "@/domain/league-families";

import { FamilyBadge } from "./family-badge";

const text = messages.leagues;

/**
 * One of the player's leagues in « Mes ligues » (#552): name, players and competitions, and on the
 * right the player's place with its movement since yesterday (#551) (nothing while without points).
 */
export function LeagueCard({
  href,
  name,
  memberCount,
  competitionNames,
  isPublic = false,
  isOfficial = false,
  families = [],
  standing,
}: {
  href: string;
  name: string;
  memberCount: number;
  competitionNames: string[];
  isPublic?: boolean;
  isOfficial?: boolean;
  /** The families it is limited to (#613); none: all events, no badge. */
  families?: LeagueFamily[];
  standing: { rank: number; change: number | null } | null;
}) {
  const details = [
    text.players(memberCount),
    competitionNames.length > 0 ? competitionNames.join(", ") : text.noCompetitionTag,
  ].join(" · ");
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-card p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 flex-1">
        <span className="block break-words font-extrabold">
          {name}
          {isPublic && (
            <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 align-middle text-xs font-bold text-secondary-foreground">
              {isOfficial ? text.officialBadge : text.publicBadge}
            </span>
          )}
        </span>
        {families.length > 0 && (
          <span className="block py-0.5">
            <FamilyBadge families={families} />
          </span>
        )}
        <span className="block break-words text-sm text-muted-foreground">{details}</span>
      </span>
      {standing ? (
        <span className="shrink-0 text-right">
          <span className="block font-display text-2xl font-extrabold leading-none">
            <span aria-hidden>{text.rank(standing.rank)}</span>
            <span className="sr-only">{text.rankLabel(standing.rank)}</span>
          </span>
          {standing.change !== null && (
            <Change change={standing.change} className="block w-auto text-right" />
          )}
        </span>
      ) : (
        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
          {text.noPointsYet}
        </span>
      )}
    </Link>
  );
}
