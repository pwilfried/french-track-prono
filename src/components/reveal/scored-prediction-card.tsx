import { messages } from "@/app/messages.fr";
import { Bib } from "@/components/profile/bib";
import type { Bib as BibValue } from "@/domain/bib";
import type { SlotOutcome } from "@/domain/podium";
import { cn } from "@/lib/utils";

/** The detail of a score, its labels written: a line per reason, the joker, the total. */
export type ScoredDetail = {
  lines: { label: string; points: number }[];
  subtotal: number;
  joker: { label: string; points: number } | null;
  total: number;
};

const text = messages.breakdown;

const OUTCOME_STYLE: Record<SlotOutcome, string> = {
  exact: "bg-success/20 text-success-text",
  on_podium: "bg-secondary/40 text-secondary-foreground",
  off: "bg-muted text-muted-foreground",
};

/**
 * A member's revealed prediction once the result is in (#1155): rank, pseudo, joker, the three
 * picks marked against the official podium and the points; tapping it unfolds the detail of the
 * points. The cards of one list share `group`: one open at a time, mine open first.
 */
export function ScoredPredictionCard({
  rank,
  pseudo,
  bib,
  mine,
  joker,
  picks,
  detail,
  group,
  children,
}: {
  /** Null while the points are not computed. */
  rank: number | null;
  pseudo: string;
  bib: BibValue;
  mine: boolean;
  /** The league joker played, named with its emoji. */
  joker?: string | null;
  picks: { slot: 1 | 2 | 3; name: string; outcome: SlotOutcome }[];
  detail: ScoredDetail | null;
  group: string;
  children?: React.ReactNode;
}) {
  const name = mine ? messages.reveal.me : pseudo;
  const header = (
    <>
      <div className="flex min-w-0 items-center gap-2.5 font-bold">
        <span className="w-8 shrink-0 text-center font-mono tabular-nums">
          {rank === null ? "" : (text.medals[rank] ?? text.rank(rank))}
        </span>
        <Bib bib={bib} />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {joker && (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-extrabold text-secondary-foreground">
            {joker}
          </span>
        )}
        {detail && (
          <span className="shrink-0 text-right">
            <span className="block font-mono text-lg tabular-nums">
              {text.points(detail.total)}
            </span>
            <span className="block text-xs font-semibold text-muted-foreground">
              {text.open}{" "}
              <span aria-hidden="true" className="inline-block group-open:rotate-180">
                ▾
              </span>
            </span>
          </span>
        )}
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {picks.map((pick) => (
          <li
            key={pick.slot}
            className={cn(
              "min-w-0 max-w-full rounded-full px-2.5 py-1 text-sm font-semibold [overflow-wrap:anywhere]",
              OUTCOME_STYLE[pick.outcome],
            )}
          >
            <span className="font-mono">{pick.slot}.</span> {pick.name}{" "}
            <span aria-hidden="true">{text.outcome[pick.outcome]}</span>
            <span className="sr-only">{text.outcomeLabel[pick.outcome]}</span>
          </li>
        ))}
      </ol>
    </>
  );
  return (
    <li
      aria-current={mine ? "true" : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-card border p-3.5",
        mine ? "border-2 border-secondary bg-secondary/15" : "border-border bg-card",
      )}
    >
      {detail ? (
        <details name={group} open={mine} className="group">
          <summary
            aria-label={text.label(name)}
            className="flex min-h-11 cursor-pointer list-none flex-col gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
          >
            {header}
          </summary>
          <dl className="mt-3 flex flex-col gap-1 border-t border-border pt-2 text-sm">
            {detail.lines.length === 0 && (
              <div className="flex justify-between gap-3 text-muted-foreground">
                <dt>{text.none}</dt>
                <dd className="font-mono">{text.points(0)}</dd>
              </div>
            )}
            {detail.lines.map((line) => (
              <div key={line.label} className="flex justify-between gap-3">
                <dt className="min-w-0">{line.label}</dt>
                <dd className="shrink-0 font-mono tabular-nums">{text.points(line.points)}</dd>
              </div>
            ))}
            {detail.joker && (
              <>
                <div className="flex justify-between gap-3 border-t border-border pt-1 text-muted-foreground">
                  <dt>{text.subtotal}</dt>
                  <dd className="shrink-0 font-mono tabular-nums">
                    {text.points(detail.subtotal)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="min-w-0">{detail.joker.label}</dt>
                  <dd className="shrink-0 font-mono tabular-nums">
                    {text.signed(detail.joker.points)}
                  </dd>
                </div>
              </>
            )}
            <div className="flex justify-between gap-3 border-t border-border pt-1 font-bold">
              <dt>{text.total}</dt>
              <dd className="shrink-0 font-mono tabular-nums">{text.points(detail.total)}</dd>
            </div>
          </dl>
        </details>
      ) : (
        <div className="flex flex-col gap-2">
          {header}
          <p className="text-sm text-muted-foreground">{text.pending}</p>
        </div>
      )}
      {children}
    </li>
  );
}

/** A member of the league without a prediction on the event: at the bottom, no detail. */
export function NoPredictionCard({
  pseudo,
  bib,
  mine,
}: {
  pseudo: string;
  bib: BibValue;
  mine: boolean;
}) {
  return (
    <li className="flex min-h-13 items-center gap-2.5 rounded-card border-2 border-dashed border-border bg-muted p-3.5 text-muted-foreground">
      <span className="w-8 shrink-0" />
      <Bib bib={bib} />
      <span className="min-w-0 flex-1 truncate font-bold">
        {mine ? messages.reveal.me : pseudo}
      </span>
      <span className="shrink-0 text-sm">{messages.leagueResult.noPrediction}</span>
    </li>
  );
}
