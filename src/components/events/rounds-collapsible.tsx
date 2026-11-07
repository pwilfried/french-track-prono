import { cn } from "@/lib/utils";

export type RoundAthlete = {
  athleteId: string;
  flag: string;
  name: string;
  mark: string;
  /** "Q" = qualifies by rank, "q" = qualifies by time, undefined = eliminated. */
  qualifier?: "Q" | "q";
};

export type RoundResults = {
  /** "Séries", "Demi-finales"... */
  label: string;
  /** Display timestamp for the human ("Jeu. 11 sept. · 18:30"); already formatted. */
  when: string;
  athletes: RoundAthlete[];
};

/**
 * Collapsible panel shown above the start list on a final event (v0.6, issue #C1).
 * Lets the player glance at how the field ran in the previous rounds before picking a podium.
 * `<details>` element: keyboard-accessible out of the box, state persists across re-renders.
 */
export function RoundsCollapsible({
  rounds,
  defaultOpen = false,
  className,
}: {
  rounds: RoundResults[];
  defaultOpen?: boolean;
  className?: string;
}) {
  if (rounds.length === 0) return null;

  return (
    <details
      open={defaultOpen}
      className={cn("group overflow-hidden rounded-xl border border-border bg-muted", className)}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2 font-display text-[13.5px] font-bold text-foreground">
          <span aria-hidden="true" className="text-base leading-none">
            📊
          </span>
          Perfs des tours précédents
        </span>
        <span
          aria-hidden="true"
          className="text-xs font-bold text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
        >
          ▾
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-border px-3.5 pb-3.5">
        {rounds.map((round) => (
          <section key={round.label} className="pt-2.5">
            <h3 className="mb-1.5 flex justify-between font-display text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {round.label}
              <span className="font-sans text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                {round.when}
              </span>
            </h3>
            <ol className="flex flex-col gap-0.5">
              {round.athletes.map((a, i) => (
                <li
                  key={a.athleteId}
                  className={cn(
                    "grid grid-cols-[22px_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                    a.qualifier ? "bg-success-text/10 font-semibold" : "bg-card text-foreground/90",
                  )}
                >
                  <span className="text-center font-display text-sm font-extrabold text-foreground/70">
                    {i + 1}
                  </span>
                  <span className="min-w-0 truncate">
                    <span aria-hidden="true" className="mr-1">
                      {a.flag}
                    </span>
                    {a.name}
                    {a.qualifier && (
                      <span className="ml-1.5 text-[10px] font-bold text-success-text">
                        {a.qualifier}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                    {a.mark}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </details>
  );
}
