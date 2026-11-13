import { messages } from "@/app/messages.fr";
import { cn } from "@/lib/utils";

import { DateTile } from "./date-tile";
import { VenueChip } from "./venue-chip";
import type { SheetCompetition } from "./competition-sheet";

const text = messages.competitions;

/**
 * The head of the « Compétitions » tab (#659): the competition shown as a card button, with its
 * first day, its name as the page title, its city, dates and number of events, and « Changer »,
 * which opens the sheet to choose another one. Without `onChange` it is a plain card (no choice).
 */
export function CompetitionButton({
  competition,
  onChange,
  expanded = false,
}: {
  competition: SheetCompetition;
  onChange?: () => void;
  expanded?: boolean;
}) {
  const details = [
    competition.city,
    messages.competition.dates(competition.startsOn, competition.endsOn),
    competition.finals > 0 ? messages.start.events(competition.finals) : text.noProgram,
  ]
    .filter(Boolean)
    .join(" · ");
  const body = (
    <>
      <DateTile date={competition.startsOn} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <h1 className="font-display text-xl font-extrabold leading-tight [overflow-wrap:anywhere]">
            {competition.name}
          </h1>
          <VenueChip venue={competition.venue} />
        </span>
        <span className="text-sm text-muted-foreground">{details}</span>
      </span>
    </>
  );
  const frame = "flex w-full items-center gap-3 rounded-card border border-border bg-card p-3";
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {text.label}
      </p>
      {onChange ? (
        <div className={cn(frame, "relative")}>
          {body}
          <button
            type="button"
            onClick={onChange}
            aria-haspopup="dialog"
            aria-expanded={expanded}
            aria-label={text.changeLabel(competition.name)}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-bold text-brand-ink after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {text.change} ›
          </button>
        </div>
      ) : (
        <div className={frame}>{body}</div>
      )}
    </div>
  );
}

/** The head card while the page loads. */
export function CompetitionButtonSkeleton() {
  return (
    <div className="flex flex-col gap-1.5" aria-hidden="true">
      <span className="h-3 w-24 rounded bg-muted" />
      <span className="h-[74px] animate-pulse rounded-card bg-muted motion-reduce:animate-none" />
    </div>
  );
}
