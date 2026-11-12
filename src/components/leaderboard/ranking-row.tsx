import { messages } from "@/app/messages.fr";
import { Bib } from "@/components/profile/bib";
import type { Bib as BibValue } from "@/domain/bib";
import type { RankedPlayer } from "@/domain/ranking";
import { cn } from "@/lib/utils";

import { PlayerCard } from "./player-card";
import { PlayerName, RankingItem } from "./player-name";

export type LeaderboardRow = RankedPlayer & {
  bib: BibValue;
  /** Shown on the player's card (#342). */
  club?: string | null;
  /** Places won (+) or lost (−) since yesterday (#551); null or absent: not shown. */
  change?: number | null;
};

/** ▲ won, ▼ lost, « = » same place as yesterday (#551). */
function Change({ change }: { change: number }) {
  const [symbol, style] =
    change > 0
      ? [`▲${change}`, "text-success-text"]
      : change < 0
        ? [`▼${-change}`, "text-accent-text"]
        : ["=", "text-muted-foreground"];
  return (
    <span className={cn("w-8 shrink-0 text-center font-mono text-xs font-bold", style)}>
      <span aria-hidden>{symbol}</span>
      <span className="sr-only">{messages.leaderboard.change(change)}</span>
    </span>
  );
}

/** What decided a player's place, shown under the pseudo. */
function detailOf(row: LeaderboardRow, me: boolean): string {
  const parts: string[] = me ? [messages.leaderboard.me] : [];
  if (row.points === 0) parts.push(messages.leaderboard.noPoints);
  else if (row.perfectPodiums > 0) parts.push(messages.leaderboard.perfect(row.perfectPodiums));
  else if (row.winnersFound > 0) parts.push(messages.leaderboard.winners(row.winnersFound));
  return parts.join(" · ");
}

/**
 * One line of a ranking (#551): rank, bib, pseudo, move since yesterday, points. The player's own
 * line is highlighted and is the target of « Autour de moi » (`#moi`). Lives in an `<ol>`.
 */
export function RankingRow({
  row,
  me = false,
  tied = false,
  total,
}: {
  row: LeaderboardRow;
  me?: boolean;
  tied?: boolean;
  /** Players in the whole ranking, for the player's card. */
  total: number;
}) {
  const detail = detailOf(row, me);
  return (
    <RankingItem
      id={me ? "moi" : undefined}
      current={me}
      cardId={`player-card-${row.userId}`}
      card={
        <PlayerCard
          id={`player-card-${row.userId}`}
          pseudo={row.pseudo}
          bib={row.bib}
          club={row.club ?? null}
          rank={row.rank}
          total={total}
        />
      }
      className={cn(
        "flex scroll-mt-24 flex-col rounded-xl px-2 py-1.5",
        me && "bg-brand-soft text-brand-ink",
      )}
    >
      <span className="w-8 shrink-0 text-center font-mono text-lg font-bold">
        <span className="sr-only">{messages.leaderboard.position(row.rank)}</span>
        <span aria-hidden>{row.rank}</span>
        {tied && (
          <span className="block text-[10px] font-bold leading-none text-muted-foreground">
            {messages.leaderboard.tie}
          </span>
        )}
      </span>
      <Bib bib={row.bib} />
      <span className="min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">
        <PlayerName pseudo={row.pseudo}>{row.pseudo}</PlayerName>
        {detail && (
          <span
            className={cn(
              "block text-xs font-semibold",
              me ? "text-brand-ink/80" : "text-muted-foreground",
            )}
          >
            {detail}
          </span>
        )}
      </span>
      {row.change !== undefined && row.change !== null && <Change change={row.change} />}
      <span className="shrink-0 font-mono text-lg font-bold tabular-nums">
        <span aria-hidden>{row.points}</span>
        <span className="sr-only">{messages.leaderboard.points(row.points)}</span>
      </span>
    </RankingItem>
  );
}
