import Link from "next/link";

import type { CommunityTrend } from "@/application/community-trend";
import { messages } from "@/app/messages.fr";
import { MomentIcon } from "@/components/leagues/moment-card";
import { ChipStatus } from "@/components/ui/chip-status";

const text = messages.community.trend;

/** The anchor of « Ce qu'ont pronostiqué les joueurs » on the event page. */
export const REVEAL_ANCHOR = "pronos-joueurs";

/**
 * « La communauté » (#1080): what the players predicted on the last locked event. Before the
 * result, the favourite at 1st place and the number of predictions; after, whether the favourite
 * won and the share of perfect podiums. The whole card leads to what the players predicted.
 */
export function TrendCard({ trend }: { trend: CommunityTrend }) {
  const event = messages.events.name(trend.discipline, trend.gender);
  const name = trend.favourite.name ?? messages.picker.other;
  return (
    <Link
      href={`/epreuves/${trend.slug}#${REVEAL_ANCHOR}`}
      className="flex items-start gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
    >
      <MomentIcon emoji={text.emoji} />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <ChipStatus tone="brand" className="self-start">
          {text.label}
        </ChipStatus>
        <span className="font-bold leading-tight break-words">{event}</span>
        {trend.result ? (
          <>
            <span className="text-sm break-words">
              {(trend.result.favouriteWon ? text.favouriteWon : text.favouriteLost)(name)}
            </span>
            <span className="text-sm font-semibold break-words text-muted-foreground">
              {text.perfect(trend.result.perfectPercent)}
            </span>
          </>
        ) : (
          <>
            <span className="text-sm break-words">
              {text.favourite(name, trend.favourite.percent)}
            </span>
            <span className="text-sm font-semibold break-words text-muted-foreground">
              {text.predictions(trend.total)}
            </span>
          </>
        )}
      </span>
    </Link>
  );
}
