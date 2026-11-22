"use client";

import Link from "next/link";
import { messages } from "@/app/messages.fr";
import type { PredictionJoker } from "@/domain/league-jokers";

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

/** The trend a spy played in a league shows, under the league on the page of the event. */
export function SpyTrendCard({ league, trend }: { league: string; trend: SpyTrend }) {
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
