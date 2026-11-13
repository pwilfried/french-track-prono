import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { VenueChip } from "@/components/events/venue-chip";
import type { CompetitionScope, CompetitionVenue } from "@/domain/competition";

import { HowItWorks } from "./how-it-works";

const text = messages.visitorHome;
const heading =
  "border-b border-border pb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground";
const outline =
  "flex min-h-12 items-center justify-center rounded-2xl border-[1.5px] text-[15px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export type VisitorHomeProps = {
  /** Where « Faire mon premier prono » leads: the sign-in, then the first open final. */
  playHref: string;
  /** The scale: points for one athlete at the right place, for a perfect podium. */
  exactPoints: number;
  perfectPoints: number;
  /** The next competition; null shows the empty state. */
  competition: {
    slug: string;
    scope: CompetitionScope;
    venue: CompetitionVenue;
    name: string;
    place: string;
    finals: number;
    daysLeft: number;
  } | null;
};

/** The visitor's home (#439, board A « Joue tout de suite »): one action, three steps, then more. */
export function VisitorHome({
  playHref,
  exactPoints,
  perfectPoints,
  competition,
}: VisitorHomeProps) {
  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3.5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {text.eyebrow}
        </p>
        <h1 className="font-display text-[40px] font-extrabold uppercase leading-none">
          {text.title}
        </h1>
        <p className="text-base leading-normal text-muted-foreground">{text.intro}</p>
        <Link
          href={playHref}
          className="flex min-h-[52px] items-center justify-center rounded-2xl bg-primary px-4 text-[17px] font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {text.play}
        </Link>
        <p className="text-center text-[13px] text-muted-foreground">{text.free}</p>
      </section>

      <HowItWorks exactPoints={exactPoints} perfectPoints={perfectPoints} />

      <section aria-labelledby="next-competition" className="flex flex-col gap-3">
        <h2 id="next-competition" className={heading}>
          {text.nextTitle}
        </h2>
        {competition ? (
          <article className="flex flex-col gap-3 rounded-card bg-brand p-4 text-brand-foreground">
            <div className="flex items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[#d9e4f5]">
                  {messages.adminCompetitions.scope[competition.scope]}
                </span>
                <VenueChip venue={competition.venue} />
              </span>
              <span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold tabular-nums text-gold-ink">
                {messages.start.inDays(competition.daysLeft)}
              </span>
            </div>
            <h3 className="font-display text-2xl font-extrabold leading-tight">
              {competition.name}
            </h3>
            <p className="text-sm text-[#d9e4f5]">
              {[competition.place, messages.start.events(competition.finals)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <Link
              href={`/competitions?competition=${competition.slug}`}
              className={`${outline} border-white/70 text-white hover:bg-white/10`}
            >
              {text.seeEvents}
            </Link>
          </article>
        ) : (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            {messages.start.none}
          </p>
        )}
      </section>

      <section
        aria-labelledby="with-friends"
        className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-4"
      >
        <h2 id="with-friends" className="font-display text-xl font-extrabold">
          {text.friendsTitle}
        </h2>
        <p className="text-sm leading-snug text-muted-foreground">{text.friends}</p>
        <Link
          href={competition ? `/ligues/creer?competition=${competition.slug}` : "/ligues/creer"}
          className={`${outline} border-foreground text-foreground hover:bg-muted`}
        >
          {text.createLeague}
        </Link>
      </section>
    </div>
  );
}
