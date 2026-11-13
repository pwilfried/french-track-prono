import Link from "next/link";

import type { MySeason } from "@/application/manager-home";
import { messages } from "@/app/messages.fr";
import { Bib } from "@/components/profile/bib";
import { buttonVariants } from "@/components/ui/button";
import { countdown, splitDuration } from "@/domain/countdown";
import { seasonSteps, type SeasonStep } from "@/domain/manager-home";
import { cn } from "@/lib/utils";

const text = messages.managerHome;
/** Light blue on the night blue, the same in both themes (AA). */
const soft = "text-[#d9e4f5]";
const eyebrow = `text-xs font-bold uppercase tracking-wide ${soft}`;

export type ManagerHomeProps = {
  /** The season of the player's league; null without a Manager league. */
  season: MySeason | null;
  /** For the time left before the lineup locks. */
  now: Date;
};

/**
 * The Manager home (#606, board « 1 · Accueil Manager »): « Ma saison » on the night blue with the
 * action of the moment, the shortcuts, then the steps of the season. Without a league: the steps
 * and the ways in only.
 */
export function ManagerHome({ season, now }: ManagerHomeProps) {
  return (
    <div className="flex flex-col gap-5">
      {season ? (
        <>
          <MySeasonCard season={season} now={now} />
          <Shortcuts season={season} />
        </>
      ) : (
        <StartCard />
      )}
      <SeasonSteps current={season?.step ?? "league"} />
    </div>
  );
}

function actionHref(season: MySeason): string {
  const base = `/manager/${season.leagueId}`;
  switch (season.step) {
    case "league":
      return base;
    case "mercato":
      return `${base}/catalogue`;
    case "team":
      return `${base}/equipe`;
    case "lineup":
      return season.lineup ? `${base}/alignement/${season.lineup.slug}` : `${base}/alignement`;
    case "points":
    case "duels":
      return `${base}/journee`;
    case "champion":
      return `${base}/fin-de-saison`;
  }
}

/** « Aligner mon équipe · verrouillage dans 2 j » on the lineup step, else the step's action. */
function actionLabel(season: MySeason, now: Date): string {
  if (season.step !== "lineup" || !season.lineup) return text.action[season.step];
  const left = countdown(now, season.lineup.lockAt);
  return left.phase === "open"
    ? text.lineupAction(messages.countdown.duration(splitDuration(left.remainingSeconds)))
    : text.action.lineup;
}

function MySeasonCard({ season, now }: { season: MySeason; now: Date }) {
  const { standing, next, round } = season;
  return (
    <section
      aria-labelledby="my-season"
      className="flex flex-col gap-3.5 rounded-card bg-nuit p-4 text-white ring-1 ring-white/10"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="my-season" className={eyebrow}>
          {text.mySeason}
        </h2>
        <p className="break-words font-display text-xl font-extrabold leading-tight">
          {text.league(season.leagueName, season.players)}
        </p>
        <p className={`text-sm ${soft}`}>
          {round ? text.round(round.current, round.total) : text.notStarted}
        </p>
      </div>

      {standing && (
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/10 px-2 py-2">
            <dt className={eyebrow}>{text.place}</dt>
            <dd className="font-display text-2xl font-extrabold">{text.rank(standing.rank)}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-2">
            <dt className={eyebrow}>{text.points}</dt>
            <dd className="font-display text-2xl font-extrabold">{standing.points}</dd>
            <dd className={`text-xs ${soft}`}>
              {text.record(standing.wins, standing.draws, standing.losses)}
            </dd>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-2">
            <dt className={eyebrow}>{text.difference}</dt>
            <dd className="font-display text-2xl font-extrabold">
              {messages.managerChampionship.difference(standing.difference)}
            </dd>
          </div>
        </dl>
      )}

      {next && (
        <div className="flex flex-col gap-1.5">
          <h3 className={eyebrow}>{text.nextTitle(next.round)}</h3>
          <p
            aria-label={text.nextDuel(next.me.pseudo, next.opponent.pseudo)}
            className="flex flex-wrap items-center gap-2 font-semibold"
          >
            <Bib bib={next.me.bib} />
            <span className="min-w-0 break-words">{next.me.pseudo}</span>
            <span className={`text-sm ${soft}`}>{text.vs}</span>
            <Bib bib={next.opponent.bib} />
            <span className="min-w-0 break-words">{next.opponent.pseudo}</span>
          </p>
        </div>
      )}

      <Link
        href={actionHref(season)}
        className={cn(buttonVariants(), "w-full whitespace-normal px-4 py-2 text-center")}
      >
        {actionLabel(season, now)}
      </Link>
    </section>
  );
}

function Shortcuts({ season }: { season: MySeason }) {
  const base = `/manager/${season.leagueId}`;
  const links = [
    { href: `${base}/equipe`, label: text.team },
    { href: `${base}/classement`, label: text.standings },
    { href: `${base}/journee`, label: text.calendar },
    ...(season.lastPoints
      ? [{ href: `${base}/points/${season.lastPoints}`, label: text.lastPoints }]
      : []),
  ];
  return (
    <nav aria-label={text.shortcuts}>
      <ul className="grid grid-cols-2 gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="flex min-h-12 items-center justify-center rounded-2xl border border-border bg-card px-3 text-center text-sm font-bold"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function StartCard() {
  return (
    <section
      aria-labelledby="manager-start"
      className="flex flex-col gap-3 rounded-card bg-nuit p-4 text-white ring-1 ring-white/10"
    >
      <h2 id="manager-start" className="font-display text-xl font-extrabold">
        {text.startTitle}
      </h2>
      <Link href="/manager/creer" className={cn(buttonVariants(), "w-full")}>
        {messages.manager.create}
      </Link>
      <Link
        href="/manager/rejoindre"
        className={cn(buttonVariants({ variant: "muted" }), "w-full")}
      >
        {messages.manager.joinWithCode}
      </Link>
    </section>
  );
}

function SeasonSteps({ current }: { current: SeasonStep }) {
  return (
    <section aria-labelledby="season-steps" className="flex flex-col gap-2">
      <h2
        id="season-steps"
        className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
      >
        {text.stepsTitle}
      </h2>
      <ol aria-labelledby="season-steps" className="flex flex-col gap-1.5">
        {seasonSteps(current).map(({ step, state }, i) => (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-2xl border px-3.5 py-2",
              state === "current"
                ? "border-primary bg-primary-soft text-primary-ink"
                : "border-border bg-card",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-8 flex-none items-center justify-center rounded-full font-display text-sm font-extrabold",
                state === "done" && "bg-success text-nuit",
                state === "current" && "bg-primary text-primary-foreground",
                state === "todo" && "bg-muted text-muted-foreground",
              )}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="break-words font-bold">
                {text.steps[step].title}
                <span className="sr-only"> ({text.stepState[state]})</span>
              </span>
              <span
                className={cn(
                  "break-words text-sm",
                  state === "current" ? "text-primary-ink" : "text-muted-foreground",
                )}
              >
                {text.steps[step].text}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
