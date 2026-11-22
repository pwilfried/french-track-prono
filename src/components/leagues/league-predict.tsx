import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { ChipStatus } from "@/components/ui/chip-status";
import { competitionDay, TIME_ZONE, utcToParis } from "@/domain/competition";
import { countdown, splitDuration } from "@/domain/countdown";
import type { EventGender } from "@/domain/event";
import type { LeaguePredict as Call } from "@/domain/league-predict";
import { cn } from "@/lib/utils";

const text = messages.leagues.predict;

const shortDay = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});
const time = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export type PredictFinal = {
  slug: string;
  competitionSlug: string;
  discipline: string;
  gender: EventGender;
  startsAt: string;
  lockAt: string;
};

export type LeaguePredictProps = {
  call: Call<PredictFinal, { startsOn: string }> | null;
  now: Date;
};

const parisDate = (iso: string) => utcToParis(iso).slice(0, 10);

/** « Aujourd'hui », « Demain », else « sam. 13 sept. » (Paris time). */
function dayLabel(iso: string, now: Date): string {
  const day = parisDate(iso);
  if (day === parisDate(now.toISOString())) return text.today;
  if (day === parisDate(new Date(now.getTime() + 86_400_000).toISOString())) return text.tomorrow;
  return shortDay.format(new Date(iso));
}

function timeLeft(now: Date, lockAt: string): string {
  const left = countdown(now, lockAt);
  return messages.countdown.duration(
    splitDuration(left.phase === "open" ? left.remainingSeconds : 0),
  );
}

const competitionLink = (final: PredictFinal, filter: "todo" | "posed") =>
  `/competitions?${new URLSearchParams({
    competition: final.competitionSlug,
    jour: competitionDay(final.startsAt),
    filtre: filter,
  })}`;

const eyebrow = "text-xs font-bold uppercase tracking-wider text-muted-foreground";

/**
 * The « Pronostiquer » block on top of a league (#1069): the next final to predict (or the open
 * finals of that day), « Mes pronos sont posés » once all are, else when the next one opens.
 */
export function LeaguePredict({ call, now }: LeaguePredictProps) {
  if (!call) return null;
  if (call.kind === "next") {
    return (
      <p
        role="status"
        className="flex items-center gap-2.5 rounded-2xl bg-muted px-3.5 py-3 text-sm text-muted-foreground"
      >
        <CalendarIcon />
        <span className="min-w-0">
          {text.none}{" "}
          <strong className="font-bold text-foreground">
            {shortDay.format(new Date(`${call.competition.startsOn}T12:00:00Z`))}
          </strong>
        </span>
      </p>
    );
  }
  if (call.kind === "done") {
    const { first, posed } = call;
    const lock = new Date(first.lockAt);
    const until =
      parisDate(first.lockAt) === parisDate(now.toISOString())
        ? text.untilTime(time.format(lock))
        : text.untilDay(shortDay.format(lock), time.format(lock));
    return (
      <section
        aria-label={text.doneTitle}
        className="flex items-center gap-3 rounded-card bg-success-soft p-3.5 text-success-ink"
      >
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-success-ink text-lg font-extrabold text-success-soft"
        >
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{text.doneTitle}</p>
          <p className="text-sm">{text.done(posed, until)}</p>
        </div>
        <Link
          href={competitionLink(first, "posed")}
          aria-label={text.seeLabel}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "shrink-0 border-current px-4 text-sm text-success-ink",
          )}
        >
          {text.see}
        </Link>
      </section>
    );
  }

  const { finals } = call;
  const [first] = finals;
  if (!first) return null;
  const many = finals.length > 1;
  const firstLock = finals.reduce((a, b) => (Date.parse(b.lockAt) < Date.parse(a.lockAt) ? b : a));
  return (
    <section
      aria-label={text.label}
      className="flex flex-col gap-3 rounded-card bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={eyebrow}>{many ? text.nextMany : text.next}</h2>
        <ChipStatus tone="ok">{many ? text.openCount(finals.length) : text.open}</ChipStatus>
      </div>
      {many ? (
        <>
          <p className="text-sm text-muted-foreground">
            {text.manyFinals(dayLabel(first.startsAt, now), finals.length)}
          </p>
          <ul className="flex flex-col gap-1">
            {finals.map((f) => (
              <li key={f.slug} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 break-words font-bold">
                  {messages.events.name(f.discipline, f.gender)}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                  {time.format(new Date(f.startsAt))}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {text.firstLocksIn(timeLeft(now, firstLock.lockAt))}
          </p>
        </>
      ) : (
        <div>
          <p className="text-lg font-extrabold leading-tight break-words">
            {messages.events.name(first.discipline, first.gender)}
          </p>
          <p className="text-sm text-muted-foreground">
            {text.startsAt(
              dayLabel(first.startsAt, now),
              time.format(new Date(first.startsAt)),
              timeLeft(now, first.lockAt),
            )}
          </p>
        </div>
      )}
      <Link
        href={many ? competitionLink(first, "todo") : `/epreuves/${first.slug}`}
        className={cn(buttonVariants(), "min-h-14 w-full font-extrabold")}
      >
        {text.play}
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}
