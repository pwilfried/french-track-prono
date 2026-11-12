import Link from "next/link";
import type { ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import { cn } from "@/lib/utils";

const text = messages.howItWorks;

export type HowItWorksProps = {
  /** The scale: points for one athlete at the right place, for a perfect podium. */
  exactPoints: number;
  perfectPoints: number;
  /** The three steps on one line, titles only (the player's home, #526). */
  compact?: boolean;
  /** Shown next to the title: the player's home puts its × there. */
  action?: ReactNode;
};

/**
 * « Comment ça marche » (#439): three steps and a link to the rules. The visitor's home shows it,
 * and so does the player's until a first prediction (#476), on one line (#526).
 */
export function HowItWorks({ exactPoints, perfectPoints, compact, action }: HowItWorksProps) {
  return (
    <section aria-labelledby="how-it-works" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 border-b border-border">
        <h2
          id="how-it-works"
          className="pb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"
        >
          {text.title}
        </h2>
        {action}
      </div>
      <ol className={cn(compact ? "grid grid-cols-3 gap-2" : "flex flex-col gap-3")}>
        {text.steps(exactPoints, perfectPoints).map((step, i) => (
          <li
            key={step.title}
            className={cn(
              "flex rounded-card border border-border bg-card",
              compact ? "flex-col items-center gap-2 p-3 text-center" : "items-start gap-3 p-3.5",
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-9 flex-none items-center justify-center rounded-full bg-brand font-display text-lg font-extrabold text-brand-foreground"
            >
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h3 className={cn("font-bold", compact ? "text-sm leading-snug" : "text-base")}>
                {step.title}
              </h3>
              <p className={cn("text-sm leading-snug text-muted-foreground", compact && "sr-only")}>
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <Link
        href="/regles"
        className="inline-flex min-h-11 items-center self-start text-sm font-bold underline underline-offset-4"
      >
        {text.allRules}
      </Link>
    </section>
  );
}
