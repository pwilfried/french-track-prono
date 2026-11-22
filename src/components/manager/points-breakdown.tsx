import { messages } from "@/app/messages.fr";
import type { MyManagerScore } from "@/application/manager-scores";
import { athleteInitials } from "@/domain/manager-team";
import { cn } from "@/lib/utils";

const text = messages.managerPoints;

/**
 * « Mes points » of a scored competition (#431, #1036), as in the validated mock-up « Manager ·
 * feuille de match »: « Tables ÷ 10 », « Bonus » and « Total », how the tables are used, then every
 * athlete who counted with their mark, points, calculation and golden bonuses (a substitute says
 * whom they replaced), then « Sur le banc »: the starters replaced and why, the substitutes who did
 * not come in.
 */
export function PointsBreakdown({
  mine,
}: {
  mine: Pick<MyManagerScore, "divisor" | "carriedFrom" | "bench"> & {
    score: NonNullable<MyManagerScore["score"]>;
  };
}) {
  const { score, divisor, bench } = mine;
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label={text.summary}
        className="flex flex-col gap-3 rounded-card bg-nuit p-4 text-white ring-1 ring-white/10"
      >
        <dl className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              [text.hungarian(divisor), score.hungarian, false],
              [text.bonus, score.bonus, false],
              [text.total, score.total, true],
            ] as const
          ).map(([label, value, total]) => (
            <div
              key={label}
              className={cn(
                "rounded-xl px-2 py-2",
                total ? "bg-secondary text-nuit" : "bg-white/10",
              )}
            >
              <dt className={cn("text-[11px] font-semibold", !total && "text-white/80")}>
                {label}
              </dt>
              <dd className="font-mono text-2xl font-extrabold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-white/80">{text.explain(divisor)}</p>
      </section>

      {!score.linedUp ? (
        <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
          {text.noLineup}
        </p>
      ) : (
        <>
          {mine.carriedFrom !== null && (
            <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
              {text.carriedFrom(mine.carriedFrom)}
            </p>
          )}
          <section aria-labelledby="starters" className="flex flex-col gap-2">
            <h2
              id="starters"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {text.starters}
            </h2>
            <ul aria-labelledby="starters" className="flex flex-col gap-2">
              {score.athletes.map((a) => {
                const out = a.status !== null && a.status !== "ok";
                return (
                  <li
                    key={a.athleteId}
                    aria-label={a.name}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-nuit font-display text-sm font-extrabold text-white"
                    >
                      {athleteInitials(a.name)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="break-words font-semibold">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{text.performance(a)}</span>
                      {(a.tablePoints !== undefined || a.substitution) && (
                        <span className="text-xs text-muted-foreground">
                          {[
                            a.tablePoints !== undefined &&
                              text.calculation(a.tablePoints, divisor, a.points),
                            a.substitution &&
                              text.cameIn(a.starterName ?? "?", a.substitution.reason),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                      {a.bonuses.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {a.bonuses.map((b) => (
                            <span
                              key={b.bonus}
                              className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold-ink"
                            >
                              {text.bonusTag(b.bonus, b.points)}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-xl font-extrabold tabular-nums",
                        (out || a.total === 0) && "text-accent-text",
                      )}
                    >
                      {text.athletePoints(a.total)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section aria-labelledby="bench" className="flex flex-col gap-2">
            <h2
              id="bench"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {text.bench}
            </h2>
            {bench.replaced.length + bench.unused.length === 0 ? (
              <p className="text-sm text-muted-foreground">{text.benchEmpty}</p>
            ) : (
              <ul aria-labelledby="bench" className="flex flex-col gap-2">
                {bench.replaced.map((r) => (
                  <li
                    key={r.athleteId}
                    aria-label={r.name}
                    className="flex flex-col gap-0.5 rounded-2xl bg-muted px-3.5 py-2.5"
                  >
                    <span className="break-words font-semibold">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {text.replaced(r.reason, r.status, r.mark, r.substituteName)}
                    </span>
                  </li>
                ))}
                {bench.unused.map((u) => (
                  <li
                    key={u.athleteId}
                    aria-label={u.name}
                    className="flex flex-col gap-0.5 rounded-2xl bg-muted px-3.5 py-2.5"
                  >
                    <span className="break-words font-semibold">{u.name}</span>
                    <span className="text-xs text-muted-foreground">{text.unused}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
