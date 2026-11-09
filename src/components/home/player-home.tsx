import Link from "next/link";

import type { RankingRow } from "@/application/rankings";
import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { countdown, splitDuration } from "@/domain/countdown";
import type { EventSummary } from "@/domain/event";
import type { OpenFinal } from "@/domain/home";
import { cn } from "@/lib/utils";

const text = messages.playerHome;
const PODCAST = "https://podcastics.com/podcast/french-track";

const eventName = (event: Pick<EventSummary, "discipline" | "gender">) =>
  `${event.discipline} ${messages.events.gender[event.gender].toLowerCase()}`;

const card = "rounded-card border border-border bg-card/90 p-4 backdrop-blur-sm";
const heading = "text-xs font-bold uppercase tracking-wide text-muted-foreground";

export type PlayerHomeProps = {
  pseudo: string;
  competitionName: string;
  competitionSlug: string;
  /** False: the next final offers to create a private or a public league first (#369). */
  hasLeagueForCompetition: boolean;
  timeZone: string;
  now: Date;
  finals: OpenFinal[];
  general: { me: RankingRow | null; total: number; podium: RankingRow[] } | null;
  league: { id: string; name: string; me: RankingRow | null } | null;
  lastResult: { event: EventSummary; points: number | null } | null;
};

/** The signed-in player's home (#346, board A+): what to do next, where they stand. */
export function PlayerHome(props: PlayerHomeProps) {
  const { pseudo, competitionName, competitionSlug, hasLeagueForCompetition, timeZone, now } =
    props;
  const { finals, general, league, lastResult } = props;
  const next = finals[0];
  const left = next ? countdown(now, next.lockAt) : null;
  const when = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
  const hour = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone });

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className={heading}>{text.hello(pseudo)}</p>
        <h1 className="font-display text-[34px] font-extrabold leading-none">
          {left?.phase === "open"
            ? text.nextFinalIn(messages.countdown.duration(splitDuration(left.remainingSeconds)))
            : text.noFinalTitle}
        </h1>
      </div>

      {next ? (
        <section
          aria-labelledby="next-final"
          className="flex flex-col gap-3.5 rounded-card bg-brand p-4 text-white"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#d9e4f5]">
              {competitionName}
            </span>
            <span className="rounded-full bg-gold-soft px-2.5 py-1 font-mono text-xs font-bold text-gold-ink">
              {hour.format(new Date(next.startsAt))}
            </span>
          </div>
          <h2 id="next-final" className="font-display text-[26px] font-extrabold leading-tight">
            {eventName(next)}
          </h2>
          {hasLeagueForCompetition ? (
            <>
              <p className="text-sm text-[#d9e4f5]">
                {next.predicted ? text.podiumDone : text.podiumEmpty}
              </p>
              <Link href={`/epreuves/${next.slug}`} className={cn(buttonVariants(), "w-full")}>
                {next.predicted ? text.editPodium : messages.home.compose}
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-[#d9e4f5]">{text.leagueFirst}</p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/ligues/creer?competition=${encodeURIComponent(competitionSlug)}`}
                  className={buttonVariants()}
                >
                  {text.createPrivate}
                </Link>
                <Link
                  href={`/ligues/creer?competition=${encodeURIComponent(competitionSlug)}&publique=1`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "bg-transparent text-white",
                  )}
                >
                  {text.createPublic}
                </Link>
              </div>
              <Link
                href="/ligues"
                className="inline-flex min-h-11 items-center self-center text-sm font-bold text-white underline underline-offset-4"
              >
                {text.joinPublic}
              </Link>
            </>
          )}
        </section>
      ) : (
        <p className={cn(card, "text-sm text-muted-foreground")}>{text.noFinal}</p>
      )}

      <section aria-labelledby="my-season" className="grid grid-cols-2 gap-3">
        <h2 id="my-season" className="sr-only">
          {text.season}
        </h2>
        <Link href="/classement" className={cn(card, "flex flex-col gap-1")}>
          <span className="text-xs font-bold text-muted-foreground">{text.general}</span>
          <span className="font-mono text-3xl font-bold text-gold-ink">
            {general?.me ? `#${general.me.rank}` : "–"}
          </span>
          <span className="text-sm text-muted-foreground">
            {general?.me
              ? `${messages.home.players(general.total)} · ${messages.leaderboard.points(general.me.points)}`
              : messages.home.notRanked}
          </span>
        </Link>
        <Link
          href={league ? `/ligues/${league.id}` : "/ligues"}
          className={cn(card, "flex flex-col gap-1")}
        >
          <span className="truncate text-xs font-bold text-muted-foreground">
            {league ? text.myLeague(league.name) : text.noLeague}
          </span>
          <span className="font-mono text-3xl font-bold text-gold-ink">
            {league?.me ? messages.leaderboard.position(league.me.rank) : "–"}
          </span>
          <span className="text-sm text-muted-foreground">
            {league?.me?.change
              ? messages.leaderboard.change(league.me.change)
              : league
                ? text.leagueOpen
                : text.leagueJoin}
          </span>
        </Link>
      </section>

      <section aria-labelledby="to-predict" className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="to-predict" className={heading}>
            {text.toPredict}
          </h2>
          <Link href="/epreuves" className="inline-flex min-h-11 items-center text-sm font-bold">
            {text.allEvents}
          </Link>
        </div>
        {finals.length <= 1 ? (
          <p className={cn(card, "text-sm text-muted-foreground")}>{messages.home.noneOpen}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {finals.slice(1, 4).map((final) => (
              <li key={final.id}>
                <Link
                  href={`/epreuves/${final.slug}`}
                  className={cn(card, "flex min-h-[60px] items-center gap-3 py-2.5")}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold">{eventName(final)}</span>
                    <span className="text-sm text-muted-foreground">
                      {when.format(new Date(final.startsAt))}
                      {final.predicted ? ` · ${text.predicted}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {general && general.podium.length > 0 ? (
        <section aria-labelledby="top-general" className="flex flex-col gap-2.5">
          <h2 id="top-general" className={heading}>
            {text.podium}
          </h2>
          <ol className="grid grid-cols-3 items-end gap-2">
            {[general.podium[1], general.podium[0], general.podium[2]].map((row, i) =>
              row ? (
                <li
                  key={row.userId}
                  className={cn(
                    "flex flex-col items-center justify-end gap-1 rounded-t-2xl rounded-b-md px-2 py-3 text-center",
                    i === 1
                      ? "min-h-[132px] bg-gold-soft text-gold-ink"
                      : "min-h-[104px] border border-border bg-card/90",
                  )}
                >
                  <span className="max-w-full truncate text-sm font-bold">{row.pseudo}</span>
                  <span className="text-xs">{messages.leaderboard.points(row.points)}</span>
                  <span className="font-display text-2xl font-extrabold">{row.rank}</span>
                </li>
              ) : (
                <li key={`empty-${i}`} />
              ),
            )}
          </ol>
        </section>
      ) : null}

      {lastResult ? (
        <section aria-labelledby="last-result" className={cn(card, "flex flex-col gap-2")}>
          <h2 id="last-result" className={heading}>
            {text.lastResult}
          </h2>
          <p className="font-display text-xl font-extrabold">{eventName(lastResult.event)}</p>
          <p
            className={cn(
              "text-sm font-bold",
              lastResult.points ? "text-success-text" : "text-muted-foreground",
            )}
          >
            {lastResult.points === null ? text.noPrediction : text.yourPoints(lastResult.points)}
          </p>
          <Link
            href={`/epreuves/${lastResult.event.slug}`}
            className="inline-flex min-h-11 items-center self-start text-sm font-bold"
          >
            {text.seeResult}
          </Link>
        </section>
      ) : null}

      <section
        aria-labelledby="public-leagues"
        className="flex flex-col gap-2.5 rounded-card border border-dashed border-border bg-background/80 p-4"
      >
        <h2 id="public-leagues" className="font-display text-xl font-extrabold">
          {text.publicTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{text.publicText}</p>
        <Link href="/ligues" className={buttonVariants({ variant: "outline" })}>
          {text.publicLink}
        </Link>
      </section>

      <section
        aria-labelledby="podcast"
        className="flex items-center gap-3.5 rounded-card bg-primary p-4 text-primary-foreground"
      >
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/20"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="podcast" className="font-display text-lg font-extrabold">
            {text.podcastTitle}
          </h2>
          <span className="text-sm">{text.podcastText}</span>
        </span>
        <a
          href={PODCAST}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white px-3.5 text-sm font-bold text-accent-text"
        >
          {text.podcastLink}
        </a>
      </section>
    </>
  );
}
