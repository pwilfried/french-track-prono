import { messages } from "@/app/messages.fr";
import type { TeamBuild } from "@/domain/manager-build";
import { cn } from "@/lib/utils";

const text = messages.catalogue.bidsRecap;

/**
 * The bids of the round by family, on top of the mercato (#1088): athletes won and bids running
 * against the minimum of the family, and the budget engaged.
 */
export function BidsRecap({
  build,
  engaged,
  budget,
}: {
  build: TeamBuild;
  engaged: number;
  budget: number;
}) {
  const over = engaged > budget;
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <h3 className="text-sm font-bold">{text.title}</h3>
      {build.bidding === 0 && <p className="text-sm text-muted-foreground">{text.none}</p>}
      <ul className="grid grid-cols-2 gap-2">
        {build.families.map((f) => (
          <li
            key={f.family}
            aria-label={text.row(messages.team.groups[f.family], f.won, f.bidding, f.need)}
            className={cn(
              "flex min-h-11 flex-col justify-center rounded-xl px-2.5 py-1.5 text-xs font-semibold",
              f.done ? "bg-success-soft text-success-ink" : "bg-muted",
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 break-words">{messages.team.groups[f.family]}</span>
              <span aria-hidden="true" className="font-mono tabular-nums">
                {f.have}/{f.need}
              </span>
            </span>
            <span aria-hidden="true" className="font-normal text-muted-foreground">
              {text.won(f.won)} · {text.bids(f.bidding)}
            </span>
          </li>
        ))}
      </ul>
      <p
        role={over ? "alert" : undefined}
        className={cn("text-sm font-semibold", over && "text-accent-text")}
      >
        {text.committed(engaged, budget)}
        {over && ` ${text.overBudget}`}
      </p>
    </div>
  );
}
