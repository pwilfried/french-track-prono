import type { ScoreLine } from "@/application/compute-event-points";
import { messages } from "@/app/messages.fr";
import { scoreSummary } from "@/domain/score-summary";

export type Scored = ScoreLine & { pseudo: string };

/** The figures and the per-player detail of a computation, stored or previewed. */
export function ScoreTable({ lines, title }: { lines: Scored[]; title: string }) {
  const summary = scoreSummary(lines.map((l) => l.points));
  return (
    <>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          [messages.admin.kpi.predictions, summary.players],
          [messages.admin.kpi.total, summary.total],
          [messages.admin.kpi.atZero, summary.atZero],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col-reverse rounded-2xl border border-border bg-card p-2.5"
          >
            <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
            <dd className="font-mono text-2xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-center text-sm text-muted-foreground">
        {messages.admin.kpi.averageAndBest(
          summary.average.toLocaleString("fr-FR", { maximumFractionDigits: 1 }),
          summary.best,
        )}
      </p>
      <h2 className="pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <ul className="flex flex-col">
        {lines.map((s) => (
          <li
            key={s.userId}
            className="flex min-h-12 items-center gap-3 border-b border-border py-2"
          >
            <span className="min-w-0 flex-1 break-words font-semibold">{s.pseudo}</span>
            <span className="font-mono text-lg font-extrabold text-success-text">{s.points}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
