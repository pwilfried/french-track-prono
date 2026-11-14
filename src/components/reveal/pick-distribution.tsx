import { messages } from "@/app/messages.fr";
import type { PickShare } from "@/domain/reveal";

const SHOWN = 3;

/** Who the whole field picked as winner: the three most picked, then everyone else together. */
export function PickDistribution({
  picks,
  nameOf,
  winners,
}: {
  picks: PickShare[];
  nameOf: (athleteId: string) => string;
  winners: Set<string>;
}) {
  const top = picks.slice(0, SHOWN);
  const rest = picks.slice(SHOWN);
  const others = rest.reduce((sum, p) => sum + p.percent, 0);
  const rows = [
    ...top.map((p) => ({
      key: p.athleteId,
      name: nameOf(p.athleteId),
      percent: p.percent,
      winner: winners.has(p.athleteId),
    })),
    ...(rest.length > 0
      ? [{ key: "others", name: messages.reveal.picksOthers, percent: others, winner: false }]
      : []),
  ];
  return (
    <section className="mx-4 rounded-card border border-border bg-card p-4">
      <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {messages.reveal.picksTitle}
      </h3>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-sm">
            <span className="sr-only">
              {messages.reveal.picksLabel(row.name, row.percent)}
              {row.winner ? ` (${messages.reveal.picksWinner})` : ""}
            </span>
            <span className="flex w-36 shrink-0 items-center gap-1 truncate" aria-hidden="true">
              <span className="truncate">{row.name}</span>
              {row.winner && (
                <span className="text-success-text" title={messages.reveal.picksWinner}>
                  ✓
                </span>
              )}
            </span>
            <span
              aria-hidden="true"
              className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted dark:bg-background"
            >
              <span
                className="block h-full rounded-full bg-brand dark:bg-secondary"
                style={{ width: `${row.percent}%` }}
              />
            </span>
            <span aria-hidden="true" className="w-11 text-right font-semibold tabular-nums">
              {row.percent} %
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
