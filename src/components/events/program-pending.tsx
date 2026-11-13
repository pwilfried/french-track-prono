import Link from "next/link";
import type { ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";

const text = messages.competitions.pending;

/**
 * A competition without its programme yet (#659): the days before it starts, the « Me prévenir »
 * button (`alert`, given by the page), and a way to a competition that has events.
 */
export function ProgramPending({
  daysToStart,
  alert,
  liveHref,
}: {
  daysToStart: number;
  alert: ReactNode;
  /** A competition under way or with its programme; none: no link. */
  liveHref: string | null;
}) {
  return (
    <section
      aria-labelledby="program-pending"
      className="flex flex-col items-center gap-4 rounded-card border border-border bg-card p-5 text-center"
    >
      <h2 id="program-pending" className="font-display text-xl font-extrabold">
        {text.title}
      </h2>
      <p className="text-sm text-muted-foreground">{text.text}</p>
      <p className="rounded-full bg-brand-soft px-4 py-2 font-mono text-sm font-bold text-brand-ink">
        {text.startsIn(daysToStart)}
      </p>
      <div className="flex w-full flex-col gap-2">{alert}</div>
      {liveHref && (
        <Link href={liveHref} className={buttonVariants({ variant: "outline" })}>
          {text.seeLive}
        </Link>
      )}
    </section>
  );
}
