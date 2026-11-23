import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const text = messages.leagueResult;

function Tile({
  title,
  value,
  detail,
  highlight = false,
}: {
  title: string;
  value: string;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-xl p-2.5",
        highlight ? "bg-secondary text-secondary-foreground" : "bg-white/10",
      )}
    >
      <span className="text-xs font-semibold">{title}</span>
      <span className="truncate font-bold">{value}</span>
      {detail && <span className="font-mono text-sm tabular-nums">{detail}</span>}
    </div>
  );
}

/**
 * « Dernier résultat » at the top of a league (#1155): the last finished final that counts in it,
 * its winner in the league, my place and points, the perfect podiums, and the way to every
 * member's prediction.
 */
export function LatestResult({
  eventName,
  href,
  winner,
  mine,
  perfect,
}: {
  /** « 100 m hommes ». */
  eventName: string;
  href: string;
  /** The first of the league on the final; null while nobody has points. */
  winner: { pseudo: string; points: number } | null;
  /** My place and points; null without my prediction in the league. */
  mine: { rank: number; points: number } | null;
  perfect: number;
}) {
  return (
    <section
      aria-label={text.latest}
      className="flex flex-col gap-3 rounded-card border border-white/15 bg-nuit p-4 text-white"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white/75">{text.latest}</h2>
        <p className="break-words text-lg font-bold">{eventName}</p>
      </div>
      {winner ? (
        <div className="grid grid-cols-3 gap-2">
          <Tile
            title={text.latestWinner}
            value={winner.pseudo}
            detail={messages.format.pts(winner.points)}
          />
          {mine ? (
            <Tile
              title={text.latestMine}
              value={text.latestPlace(mine.rank)}
              detail={messages.format.pts(mine.points)}
              highlight
            />
          ) : (
            <Tile title={text.latestMine} value={messages.leagueResult.noPrediction} highlight />
          )}
          <Tile title={text.latestPerfect} value={String(perfect)} />
        </div>
      ) : (
        <p className="text-sm text-white/85">{text.latestNobody}</p>
      )}
      <Link
        href={href}
        className={cn(buttonVariants({ variant: "outline" }), "w-full bg-white text-nuit")}
      >
        {text.latestSeeAll}
      </Link>
    </section>
  );
}
