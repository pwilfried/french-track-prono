import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { ChipStatus } from "@/components/ui/chip-status";
import { TIME_ZONE } from "@/domain/competition";
import { countdown, splitDuration } from "@/domain/countdown";
import type { NextAction } from "@/domain/home";
import { cn } from "@/lib/utils";

const text = messages.playerHome.action;
/** Light blue on the FrenchTrack blue, the same in both themes (AA). */
const soft = "text-[#d9e4f5]";
const eyebrow = `text-xs font-bold uppercase tracking-wide ${soft}`;

const day = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
});
const time = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export type ActionCompetition = { slug: string; name: string; place: string; finals: number };

export type NextActionCardProps = {
  action: NextAction<ActionCompetition>;
  /** The player has never predicted: « Ton premier prono » instead of « À toi de jouer ». */
  firstPrediction: boolean;
  /** The competition of the final, for the link to its other finals. */
  competitionSlug: string;
  now: Date;
};

/**
 * « Ta prochaine action » (#526): the open final to predict, the closest to its lock, else the next
 * competition to come. One card, on the FrenchTrack blue.
 */
export function NextActionCard({
  action,
  firstPrediction,
  competitionSlug,
  now,
}: NextActionCardProps) {
  return (
    <section
      aria-labelledby="next-action-label"
      className="flex flex-col gap-3.5 rounded-card bg-brand p-4 text-brand-foreground"
    >
      <h2 id="next-action-label" className="sr-only">
        {text.label}
      </h2>
      {action.kind === "predict" ? (
        <Predict
          {...action}
          firstPrediction={firstPrediction}
          competitionSlug={competitionSlug}
          now={now}
        />
      ) : (
        <Coming {...action} />
      )}
    </section>
  );
}

function Predict({
  final,
  sameDay,
  firstPrediction,
  competitionSlug,
  now,
}: Extract<NextAction<ActionCompetition>, { kind: "predict" }> & {
  firstPrediction: boolean;
  competitionSlug: string;
  now: Date;
}) {
  const left = countdown(now, final.lockAt);
  const starts = new Date(final.startsAt);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={eyebrow}>{firstPrediction ? text.firstPrediction : text.yourTurn}</span>
        {left.phase === "open" ? (
          <ChipStatus tone={left.level === "far" ? "brand" : "gold"} className="tabular-nums">
            {text.locksIn(messages.countdown.duration(splitDuration(left.remainingSeconds)))}
          </ChipStatus>
        ) : null}
      </div>
      <h3 className="font-display text-[26px] font-extrabold leading-tight break-words">
        {messages.events.name(final.discipline, final.gender)}
      </h3>
      <p className={cn("text-sm", soft)}>
        {text.startsAt(day.format(starts), time.format(starts))}
      </p>
      <Link href={`/epreuves/${final.slug}`} className={cn(buttonVariants(), "w-full")}>
        {text.play}
      </Link>
      {sameDay > 0 ? (
        <Link
          href={`/epreuves?competition=${encodeURIComponent(competitionSlug)}`}
          className="inline-flex min-h-11 items-center self-center text-sm font-bold text-white underline underline-offset-4"
        >
          {text.sameDay(sameDay)}
        </Link>
      ) : null}
    </>
  );
}

function Coming({
  competition,
  daysLeft,
}: Extract<NextAction<ActionCompetition>, { kind: "competition" }>) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={eyebrow}>{text.nextCompetition}</span>
        <ChipStatus tone="gold" className="tabular-nums">
          {messages.start.inDays(daysLeft)}
        </ChipStatus>
      </div>
      <h3 className="font-display text-[26px] font-extrabold leading-tight break-words">
        {competition.name}
      </h3>
      <p className={cn("text-sm", soft)}>
        {[competition.place, text.finals(competition.finals)].filter(Boolean).join(" · ")}
      </p>
      <Link
        href={`/competitions/${competition.slug}`}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full border-white/70 text-white hover:bg-white/10",
        )}
      >
        {text.programme}
      </Link>
    </>
  );
}
