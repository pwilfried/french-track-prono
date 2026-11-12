import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { Bib } from "@/components/profile/bib";
import { buttonVariants } from "@/components/ui/button";
import type { Bib as BibValue } from "@/domain/bib";
import type { RankedPlayer } from "@/domain/ranking";
import { cn } from "@/lib/utils";

import { PlayerCard } from "./player-card";
import { PlayerName, RankingItem } from "./player-name";

export type LeaderboardRow = RankedPlayer & {
  bib: BibValue;
  /** Shown on the player's card (#342). */
  club?: string | null;
  /** Places won (+) or lost (−) since yesterday (#551); null: not ranked yesterday; absent: not shown. */
  change?: number | null;
};

/** ▲ green, ▼ red, « = » otherwise (#551). */
function Change({ change }: { change: number | null }) {
  const text = messages.leaderboard;
  const [symbol, style] =
    change !== null && change > 0
      ? ["▲", "text-success-text"]
      : change !== null && change < 0
        ? ["▼", "text-accent-text"]
        : ["=", "text-muted-foreground"];
  return (
    <span className={`w-9 shrink-0 text-center font-mono text-xs font-bold ${style}`}>
      <span aria-hidden>
        {symbol}
        {change ? Math.abs(change) : ""}
      </span>
      <span className="sr-only">{change === null ? text.newcomer : text.change(change)}</span>
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
 * A ranking (league or general): position, bib, pseudo, move since yesterday, points. Tied players
 * share the position and are marked "ex æquo"; the signed-in player's row is highlighted and is
 * the « Autour de moi » anchor (#moi). A null row is the gap of a ranking window (#551).
 */
export function Leaderboard({
  rows,
  meId,
  status = "ready",
  retryHref = "",
}: {
  rows: (LeaderboardRow | null)[];
  meId?: string;
  status?: "ready" | "loading" | "error";
  retryHref?: string;
}) {
  if (status === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-card bg-muted p-4">
        <p>{messages.leaderboard.error}</p>
        <Link href={retryHref} className={buttonVariants({ variant: "outline" })}>
          {messages.errors.retry}
        </Link>
      </div>
    );
  }
  if (status === "loading") {
    return (
      <div role="status" aria-label={messages.leaderboard.loading} className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-card bg-muted p-4 text-muted-foreground">
        {messages.leaderboard.empty}
      </p>
    );
  }

  const tied = (index: number) =>
    rows[index - 1]?.rank === rows[index]!.rank || rows[index + 1]?.rank === rows[index]!.rank;

  return (
    <ol
      aria-label={messages.leaderboard.label}
      className="flex flex-col gap-0.5 rounded-card border border-border bg-card p-2"
    >
      {rows.map((row, index) => {
        if (!row) {
          return (
            <li key={`gap-${index}`} aria-hidden className="py-1 text-center text-muted-foreground">
              ···
            </li>
          );
        }
        const me = row.userId === meId;
        const detail = detailOf(row, me);
        return (
          <RankingItem
            key={row.userId}
            current={me}
            cardId={`player-card-${row.userId}`}
            card={
              <PlayerCard
                id={`player-card-${row.userId}`}
                pseudo={row.pseudo}
                bib={row.bib}
                club={row.club ?? null}
                rank={row.rank}
                total={rows.length}
              />
            }
            id={me ? "moi" : undefined}
            className={cn(
              "flex flex-col rounded-xl px-2 py-1.5",
              me && "scroll-mt-24 scroll-mb-28 bg-brand-soft text-brand-ink",
            )}
          >
            <span className="w-8 shrink-0 text-center font-mono text-lg font-bold">
              <span className="sr-only">{messages.leaderboard.position(row.rank)}</span>
              <span aria-hidden>{row.rank}</span>
              {tied(index) && (
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
            {row.change !== undefined && <Change change={row.change} />}
            <span className="shrink-0 font-mono text-lg font-bold tabular-nums">
              <span aria-hidden>{row.points}</span>
              <span className="sr-only">{messages.leaderboard.points(row.points)}</span>
            </span>
          </RankingItem>
        );
      })}
    </ol>
  );
}
