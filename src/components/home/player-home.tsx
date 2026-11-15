import Link from "next/link";

import type { ChallengeSummary } from "@/application/frenchtrack";
import type { RankingRow } from "@/application/rankings";
import { messages } from "@/app/messages.fr";
import { Bib } from "@/components/profile/bib";
import { buttonVariants } from "@/components/ui/button";
import { ChipStatus } from "@/components/ui/chip-status";
import type { Announcement } from "@/domain/community";
import type { EventSummary } from "@/domain/event";
import type { ChallengeVerdict } from "@/domain/frenchtrack";
import type { LeagueStanding, NextAction } from "@/domain/home";
import { cn } from "@/lib/utils";

import { DismissibleHowItWorks } from "./dismissible-how-it-works";
import { NextActionCard, type ActionCompetition } from "./next-action-card";
import { PodcastCard } from "./podcast-card";

const text = messages.playerHome;

const card = "rounded-card border border-border bg-card/90 p-4 backdrop-blur-sm";
const heading = "text-xs font-bold uppercase tracking-wide text-muted-foreground";
const link = "inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4";

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
  mercatoOpen: boolean;
  /** « Dans ma communauté » (#673), under the league and the last result. */
  community?: React.ReactNode;
  /** The latest episode announced (#896): the podcast card shows it; null, the podcast's page. */
  episode?: Announcement | null;
  /** « Le saviez-vous ? » (#766), right under the greeting, above the next action. */
  funFact?: React.ReactNode;
  /** « Complète ton profil » (#540), under the next action; left out when the profile is complete. */
  completeProfile?: React.ReactNode;
  /** « Battez FrenchTrack » (#674): the open challenge that locks first, else the last one. */
  challenge?: (ChallengeSummary & { verdict: ChallengeVerdict | null }) | null;
};

/**
 * The signed-in player's home (#526, « Ta prochaine action »): a greeting, the one thing to do now,
 * then the league, the last result, the community (#673), the Manager and FrenchTrack. A block with
 * nothing to show is left out.
 */
export function PlayerHome(props: PlayerHomeProps) {
  const { pseudo, isNew, now, action, competitionSlug, league, lastResult } = props;
  return (
    <>
      <h1 className="text-lg font-bold text-muted-foreground">{text.hello(pseudo, isNew)}</h1>
      {props.funFact}
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
      {props.challenge ? <Challenge {...props.challenge} now={now} /> : null}
      {lastResult ? <LastResult {...lastResult} /> : null}
      {props.community}
      <Manager mercatoOpen={props.mercatoOpen} />
      <PodcastCard episode={props.episode ?? null} />
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
                  {messages.format.pts(row.points)}
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

function Challenge({
  slug,
  discipline,
  gender,
  lockAt,
  points,
  mine,
  verdict,
  now,
}: NonNullable<PlayerHomeProps["challenge"]> & { now: Date }) {
  const challenge = messages.challenge;
  const open = Date.parse(lockAt) > now.getTime();
  return (
    <section
      aria-labelledby="home-challenge"
      data-home-challenge
      className="flex flex-col gap-2 rounded-card border border-white/15 bg-nuit p-4 text-white"
    >
      <h2 id="home-challenge" className="text-xs font-bold uppercase tracking-wide text-[#d9e4f5]">
        {challenge.title}
      </h2>
      <p className="font-display text-xl font-extrabold break-words">
        {messages.events.name(discipline, gender)}
      </p>
      {verdict ? (
        <p className="font-bold">
          {challenge.verdict[verdict]}
          {mine !== null && points !== null ? (
            <span className="block font-mono text-sm font-semibold tabular-nums text-[#d9e4f5]">
              {challenge.you} {challenge.points(mine)} · {challenge.frenchTrack}{" "}
              {challenge.points(points)}
            </span>
          ) : null}
        </p>
      ) : (
        <p className="text-sm text-[#d9e4f5]">{open ? challenge.hidden : challenge.waiting}</p>
      )}
      <Link
        href={`/epreuves/${slug}`}
        className="inline-flex min-h-11 items-center justify-center self-start rounded-full bg-white px-5 font-bold text-nuit hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
      >
        {open ? challenge.predict : challenge.see}
      </Link>
      <Link href="/classement/frenchtrack" className={cn(link, "self-start")}>
        {challenge.seasonLink}
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
