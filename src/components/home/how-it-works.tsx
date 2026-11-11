import Link from "next/link";

import { messages } from "@/app/messages.fr";

const text = messages.howItWorks;

export type HowItWorksProps = {
  /** The scale: points for one athlete at the right place, for a perfect podium. */
  exactPoints: number;
  perfectPoints: number;
};

/**
 * « Comment ça marche » (#439): three steps and a link to the rules. The visitor's home shows it,
 * and so does the player's until a first prediction (#476).
 */
export function HowItWorks({ exactPoints, perfectPoints }: HowItWorksProps) {
  return (
    <section aria-labelledby="how-it-works" className="flex flex-col gap-3">
      <h2
        id="how-it-works"
        className="border-b border-border pb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"
      >
        {text.title}
      </h2>
      <ol className="flex flex-col gap-3">
        {text.steps(exactPoints, perfectPoints).map((step, i) => (
          <li
            key={step.title}
            className="flex items-start gap-3 rounded-card border border-border bg-card p-3.5"
          >
            <span
              aria-hidden="true"
              className="flex size-9 flex-none items-center justify-center rounded-full bg-brand font-display text-lg font-extrabold text-brand-foreground"
            >
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold">{step.title}</h3>
              <p className="text-sm leading-snug text-muted-foreground">{step.text}</p>
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
