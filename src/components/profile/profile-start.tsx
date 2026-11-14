import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import type { BadgeProgress } from "@/domain/badges";
import { cn } from "@/lib/utils";

import { nextBadgeText } from "./badge-grid";

const text = messages.profile.start;

/**
 * The profile before the first computed event (#799): one card instead of empty tiles, curves
 * and greyed bibs. It sends to the next open final and names the only badge worth showing yet,
 * the next one to win.
 */
export function ProfileStart({
  predictions,
  finalSlug,
  progress,
}: {
  /** Predictions saved so far, none computed yet. */
  predictions: number;
  /** The next open final, null when none is open. */
  finalSlug: string | null;
  /** Null when the badges cannot be read: the card goes without the next badge. */
  progress: BadgeProgress[] | null;
}) {
  return (
    <section
      aria-labelledby="profile-start"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <h2 id="profile-start" className="font-display text-lg font-extrabold">
        {predictions === 0 ? text.title : text.waitingTitle}
      </h2>
      <p className="text-sm text-muted-foreground">
        {predictions === 0 ? text.body : text.waiting(predictions)}
      </p>
      {progress && (
        <p className="rounded-card bg-muted p-3 text-sm font-semibold">{nextBadgeText(progress)}</p>
      )}
      <Link
        href={finalSlug ? `/epreuves/${finalSlug}` : "/competitions"}
        className={cn(buttonVariants(), "w-full")}
      >
        {finalSlug ? text.play : text.browse}
      </Link>
    </section>
  );
}
