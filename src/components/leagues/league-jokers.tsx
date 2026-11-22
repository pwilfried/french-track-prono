"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { messages } from "@/app/messages.fr";
import type { ErrorCode } from "@/application/errors";
import { buttonVariants } from "@/components/ui/button";
import type { JokerHand, PredictionJoker } from "@/domain/league-jokers";

const text = messages.leagueJokers;
const heading = "text-xs font-bold uppercase tracking-wider text-muted-foreground";

/** The jokers of a league, each with what it does (#1090): read only, as a league is created. */
export function JokerList({ jokers }: { jokers: readonly PredictionJoker[] }) {
  if (jokers.length === 0)
    return <p className="text-sm text-muted-foreground">{text.createEmpty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {jokers.map((joker) => (
        <li key={joker} className="rounded-2xl bg-gold-soft px-3.5 py-2.5 text-gold-ink">
          <span className="block font-extrabold">🃏 {text.name[joker]}</span>
          <span className="block text-sm">{text.explain[joker]}</span>
        </li>
      ))}
    </ul>
  );
}

/** A joker played, with the event it was played on (null: no longer listed). */
export type PlayedJoker = { joker: PredictionJoker; event: { name: string; href: string } | null };

/** « Mes jokers » in a league: the ones left, the ones played and on which event. */
export function MyJokers({
  remaining,
  used,
}: {
  remaining: readonly PredictionJoker[];
  used: PlayedJoker[];
}) {
  return (
    <section aria-labelledby="my-jokers" className="flex flex-col gap-3">
      <h2 id="my-jokers" className="font-display text-xl font-extrabold">
        {text.title}
      </h2>
      <div className="flex flex-col gap-1.5">
        <h3 className={heading}>{text.remaining}</h3>
        {remaining.length === 0 ? (
          <p className="text-sm text-muted-foreground">{text.noneLeft}</p>
        ) : (
          <JokerList jokers={remaining} />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className={heading}>{text.used}</h3>
        {used.length === 0 ? (
          <p className="text-sm text-muted-foreground">{text.noneUsed}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {used.map(({ joker, event }) => (
              <li
                key={joker}
                className="flex min-h-11 flex-wrap items-center gap-x-2 rounded-2xl border border-border px-3.5 py-2"
              >
                <span className="font-extrabold">🃏 {text.name[joker]}</span>
                {event && (
                  <Link
                    href={event.href}
                    className="inline-flex min-h-11 min-w-0 items-center break-words text-sm font-semibold underline underline-offset-2"
                  >
                    {text.usedOn(event.name)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** The trend the spy shows: the most picked athlete at each place, with its share. */
export type SpyTrend = { total: number; places: { name: string; percent: number }[] };

/** One league on the page of an open event, with my jokers there. */
export type EventLeagueJokersView = {
  leagueId: string;
  name: string;
  /** True when my podium counts in the league: a joker other than the spy needs it. */
  counted: boolean;
  hand: JokerHand;
  /** Shown once the spy is played on the event. */
  spy?: SpyTrend | null;
};

/** Plays a joker (null: takes it back) in a league; the error code when it is refused. */
export type PlayLeagueJoker = (
  leagueId: string,
  joker: PredictionJoker | null,
) => Promise<{ error?: ErrorCode }>;

/**
 * « Jokers de ligue » under the podium of an open event (#1090): in each league, the joker played
 * on this event, chosen among the ones left, until the lock. The spy is spent as soon as it is
 * played: its trend shows, and it can no longer change.
 */
export function EventLeagueJokers({
  leagues,
  play,
}: {
  leagues: EventLeagueJokersView[];
  play: PlayLeagueJoker;
}) {
  if (leagues.length === 0) return null;
  return (
    <section aria-labelledby="event-jokers" className="mx-4 flex flex-col gap-3">
      <div>
        <h2 id="event-jokers" className="font-display text-xl font-extrabold">
          {text.eventTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{text.eventHint}</p>
      </div>
      <ul className="flex flex-col gap-2.5">
        {leagues.map((league) => (
          <LeagueJokerRow key={league.leagueId} league={league} play={play} />
        ))}
      </ul>
    </section>
  );
}

function LeagueJokerRow({
  league,
  play,
}: {
  league: EventLeagueJokersView;
  play: PlayLeagueJoker;
}) {
  const { hand } = league;
  const [choice, setChoice] = useState<PredictionJoker | "">(hand.onEvent ?? "");
  const [answer, setAnswer] = useState<{ ok?: string; error?: ErrorCode } | null>(null);
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"play" | "remove">("play");
  const selectId = `joker-${league.leagueId}`;
  const options = [...(hand.onEvent ? [hand.onEvent] : []), ...hand.remaining];

  const send = (joker: PredictionJoker | null) => {
    setAction(joker ? "play" : "remove");
    setAnswer(null);
    startTransition(async () => {
      const result = await play(league.leagueId, joker);
      if (result.error) setAnswer({ error: result.error });
      else {
        setAnswer({ ok: joker ? text.played(text.name[joker]) : text.removed });
        if (!joker) setChoice("");
      }
    });
  };

  return (
    <li className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-3.5">
      <label htmlFor={selectId} className="font-bold break-words">
        {text.choose(league.name)}
      </label>
      {hand.onEvent === "spy" ? (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm font-semibold text-gold-ink">
          🃏 {text.spySpent}
        </p>
      ) : !hand.canChange ? (
        <p className="text-sm text-muted-foreground">{text.fixed}</p>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(choice || null);
          }}
        >
          <select
            id={selectId}
            value={choice}
            onChange={(e) => {
              setChoice(e.target.value as PredictionJoker | "");
              setAnswer(null);
            }}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border-2 border-border bg-background px-3 font-semibold"
          >
            <option value="">{text.none}</option>
            {options.map((joker) => (
              <option key={joker} value={joker}>
                {text.name[joker]}
              </option>
            ))}
          </select>
          {choice && (
            <p className="text-sm text-muted-foreground">
              {text.explain[choice]}
              {choice === "spy" && <span className="block font-semibold">{text.spyConfirm}</span>}
            </p>
          )}
          {choice && choice !== "spy" && !league.counted && (
            <p className="text-sm font-semibold">{text.addFirst}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending || !choice || choice === hand.onEvent}
              className={buttonVariants()}
            >
              {pending && action === "play" ? text.playing : text.play}
            </button>
            {hand.onEvent && (
              <button
                type="button"
                disabled={pending}
                onClick={() => send(null)}
                className={buttonVariants({ variant: "outline" })}
              >
                {pending && action === "remove" ? text.removing : text.remove}
              </button>
            )}
          </div>
        </form>
      )}
      {answer?.ok && (
        <p role="status" className="text-sm font-semibold text-success-text">
          {answer.ok}
        </p>
      )}
      {answer?.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[answer.error]}
        </p>
      )}
      {league.spy && <SpyTrendCard league={league.name} trend={league.spy} />}
    </li>
  );
}

function SpyTrendCard({ league, trend }: { league: string; trend: SpyTrend }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted px-3 py-2.5">
      <p className="text-sm font-bold">{text.spyTitle(league)}</p>
      {trend.total === 0 ? (
        <p className="text-sm text-muted-foreground">{text.spyEmpty}</p>
      ) : (
        <ol className="flex flex-col gap-0.5 text-sm">
          {trend.places.map((place, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span className="min-w-0 break-words">
                {messages.reveal.places[(["first", "second", "third"] as const)[index]!]} ·{" "}
                {place.name}
              </span>
              <span className="font-mono font-bold tabular-nums">{place.percent} %</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
