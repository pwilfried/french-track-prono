import Link from "next/link";

import type { RankingRow } from "@/application/rankings";
import { messages } from "@/app/messages.fr";
import { FRENCHTRACK_ACCOUNTS, SocialIcon } from "@/components/legal/social-icons";
import { Bib } from "@/components/profile/bib";
import { buttonVariants } from "@/components/ui/button";
import { ChipStatus } from "@/components/ui/chip-status";
import type { EventSummary } from "@/domain/event";
import type { LeagueStanding, NextAction } from "@/domain/home";
import { cn } from "@/lib/utils";

import { DismissibleHowItWorks } from "./dismissible-how-it-works";
import { NextActionCard, type ActionCompetition } from "./next-action-card";

const text = messages.playerHome;
const footer = messages.legal.footer;

const card = "rounded-card border border-border bg-card/90 p-4 backdrop-blur-sm";
const heading = "text-xs font-bold uppercase tracking-wide text-muted-foreground";
const link = "inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4";

const PODCAST = FRENCHTRACK_ACCOUNTS.find((account) => account.icon === "podcast")!;
const SOCIAL = FRENCHTRACK_ACCOUNTS.filter((account) => account !== PODCAST);

export type PlayerHomeProps = {
  userId: string;
  pseudo: string;
  /** No prediction yet: « Bienvenue », the first-prediction card and the three steps. */
  isNew: boolean;
  now: Date;
  /** Null: nothing to predict and no competition to come, the card is left out. */
  action: NextAction<ActionCompetition> | null;
  competitionSlug: string;
  /** The scale, for « Comment ça marche ». */
  exactPoints: number;
  perfectPoints: number;
  /** Null without a league; `standing` null when the player is not in its ranking. */
  league: { id: string; name: string; standing: LeagueStanding<RankingRow> | null } | null;
  /** The last event the player scored, with what earned the points. */
  lastResult: { event: EventSummary; points: number; exact: number; onPodium: number } | null;
  /** Null for a player who does not see the Manager (#615): the block is left out. */
  manager: { mercatoOpen: boolean } | null;
  /** « Complète ton profil » (#540), under the next action; left out when the profile is complete. */
  completeProfile?: React.ReactNode;
};

/**
 * The signed-in player's home (#526, « Ta prochaine action »): a greeting, the one thing to do now,
 * then the league, the last result, the Manager and FrenchTrack. A block with nothing to show is
 * left out.
 */
export function PlayerHome(props: PlayerHomeProps) {
  const { pseudo, isNew, now, action, competitionSlug, league, lastResult } = props;
  return (
    <>
      <h1 className="text-lg font-bold text-muted-foreground">{text.hello(pseudo, isNew)}</h1>
      {action ? (
        <NextActionCard
          action={action}
          firstPrediction={isNew}
          competitionSlug={competitionSlug}
          now={now}
        />
      ) : null}
      {props.completeProfile}
      {isNew ? (
        <DismissibleHowItWorks
          exactPoints={props.exactPoints}
          perfectPoints={props.perfectPoints}
        />
      ) : null}
      {league ? <MyLeague userId={props.userId} {...league} /> : <NoLeague />}
      {lastResult ? <LastResult {...lastResult} /> : null}
      {props.manager ? <Manager mercatoOpen={props.manager.mercatoOpen} /> : null}
      <FrenchTrack />
    </>
  );
}

function NoLeague() {
  return (
    <section aria-labelledby="my-league" className={cn(card, "flex flex-col gap-2.5")}>
      <h2 id="my-league" className="font-display text-xl font-extrabold leading-tight">
        {text.league.emptyTitle}
      </h2>
      <p className="text-sm text-muted-foreground">{text.league.emptyText}</p>
      <Link href="/ligues/creer" className={buttonVariants()}>
        {text.league.create}
      </Link>
      <Link href="/ligues" className={cn(link, "self-center")}>
        {text.league.joinPublic}
      </Link>
    </section>
  );
}

function MyLeague({
  userId,
  id,
  name,
  standing,
}: NonNullable<PlayerHomeProps["league"]> & { userId: string }) {
  const index = standing?.rows.findIndex((row) => row.userId === userId) ?? -1;
  const ahead = standing && index > 0 ? standing.rows[index - 1] : undefined;
  return (
    <section aria-labelledby="my-league" className={cn(card, "flex flex-col gap-3")}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="my-league" className={heading}>
          {text.league.title}
        </h2>
        <Link href={`/ligues/${id}`} className={link}>
          {text.league.ranking}
        </Link>
      </div>
      <p className="font-display text-xl font-extrabold leading-tight break-words">{name}</p>
      {standing ? (
        <>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-2xl font-bold tabular-nums">
              {text.league.place(standing.rank, standing.total)}
            </span>
            <span className="text-sm text-muted-foreground">
              {standing.gap !== null && ahead
                ? text.league.gap(standing.gap, ahead.pseudo)
                : text.league.leading}
            </span>
          </p>
          <ol className="flex flex-col gap-1">
            {standing.rows.map((row) => (
              <li
                key={row.userId}
                aria-current={row.userId === userId ? "true" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3",
                  row.userId === userId ? "bg-gold-soft font-bold text-gold-ink" : "bg-muted/60",
                )}
              >
                <span className="w-8 font-mono tabular-nums">
                  {messages.leaderboard.position(row.rank)}
                </span>
                <Bib bib={row.bib} />
                <span className="min-w-0 flex-1 truncate">{row.pseudo}</span>
                <span className="font-mono text-sm tabular-nums">
                  {messages.leaderboard.points(row.points)}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}

function LastResult({
  event,
  points,
  exact,
  onPodium,
}: NonNullable<PlayerHomeProps["lastResult"]>) {
  return (
    <section aria-labelledby="last-result" className={cn(card, "flex flex-col gap-2")}>
      <h2 id="last-result" className={heading}>
        {text.lastResult.title}
      </h2>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-display text-xl font-extrabold break-words">
            {messages.events.name(event.discipline, event.gender)}
          </p>
          <p className="text-sm text-muted-foreground">
            {text.lastResult.detail(exact, onPodium, event.gender)}
          </p>
        </div>
        <ChipStatus tone="ok" className="font-mono text-sm tabular-nums">
          {text.lastResult.points(points)}
        </ChipStatus>
      </div>
      <Link href={`/epreuves/${event.slug}`} className={cn(link, "self-start")}>
        {text.lastResult.see}
      </Link>
    </section>
  );
}

function Manager({ mercatoOpen }: { mercatoOpen: boolean }) {
  return (
    <section aria-labelledby="manager" className={cn(card, "flex flex-col gap-2")}>
      <h2 id="manager" className="font-display text-xl font-extrabold">
        {messages.manager.title}
      </h2>
      <p className="text-sm text-muted-foreground">
        {mercatoOpen ? text.manager.mercato : messages.manager.slogan}
      </p>
      <Link href="/manager" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>
        {text.manager.open}
      </Link>
    </section>
  );
}

/** On the night blue: the podcast, then FrenchTrack's accounts, as in the footer (#478). */
function FrenchTrack() {
  return (
    <section
      aria-labelledby="frenchtrack"
      className="flex flex-col gap-3 rounded-card border border-white/15 bg-nuit p-4 text-white"
    >
      <h2 id="frenchtrack" className="font-display text-xl font-extrabold">
        {text.frenchTrack.title}
      </h2>
      <p className="text-sm text-[#d9e4f5]">{text.frenchTrack.text}</p>
      <a
        href={PODCAST.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={footer.opensNewTab(text.frenchTrack.listen)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 font-bold text-nuit hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
      >
        <SocialIcon name="podcast" />
        {text.frenchTrack.listen}
      </a>
      <ul aria-label={footer.socialLabel} className="grid grid-cols-3 gap-2">
        {SOCIAL.map((account) => (
          <li key={account.href}>
            <a
              href={account.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={footer.opensNewTab(account.label)}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/40 px-2 text-sm font-bold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
              <SocialIcon name={account.icon} />
              {account.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
