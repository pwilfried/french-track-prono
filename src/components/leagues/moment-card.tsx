import type { ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import { Bib } from "@/components/profile/bib";
import { ChipStatus, type ChipTone } from "@/components/ui/chip-status";
import type { FeedMoment, MomentKind } from "@/domain/league-moments";

const text = messages.leagues.feed;

const TONE: Record<MomentKind, ChipTone> = {
  perfect_podium: "gold",
  new_leader: "brand",
  duel_result: "brand",
  mercato_win: "ghost",
  badge: "gold",
  streak: "ok",
};

/** The sentence of a moment, written from its facts: no text is ever stored (#671). */
function momentText(moment: FeedMoment): string {
  switch (moment.kind) {
    case "perfect_podium":
      return text.text.perfect_podium(
        moment.pseudo,
        moment.event ? messages.events.name(moment.event.discipline, moment.event.gender) : null,
      );
    case "new_leader":
      return text.text.new_leader(moment.pseudo);
    case "duel_result":
      return text.text.duel_result(
        moment.pseudo,
        moment.otherPseudo ?? null,
        moment.scores ?? null,
      );
    case "mercato_win":
      return text.text.mercato_win(
        moment.pseudo,
        moment.athletes?.length ?? 0,
        moment.round ?? null,
        moment.price ?? 0,
      );
    case "badge":
      return text.text.badge(
        moment.pseudo,
        moment.badge ? messages.badges[moment.badge].name : null,
        moment.level ? messages.badgeLevels.in[moment.level] : null,
      );
    case "streak":
      return text.text.streak(moment.pseudo, moment.length ?? null);
  }
}

/** The athletes won in a mercato round, folded under the sentence: names and prices (#979). */
function MercatoAthletes({ athletes }: { athletes: { name: string; price: number }[] }) {
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
        {text.athletes}
        <span
          aria-hidden="true"
          className="transition-transform group-open:rotate-90 motion-reduce:transition-none"
        >
          ›
        </span>
      </summary>
      <ul className="flex flex-col gap-1 pt-1">
        {athletes.map((athlete, i) => (
          <li
            key={`${athlete.name}:${i}`}
            className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
          >
            <span className="min-w-0 break-words">{athlete.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {text.credits(athlete.price)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The emoji of a moment, in its round badge: the same on every card of a feed. */
export function MomentIcon({ emoji }: { emoji: string }) {
  return (
    <span
      aria-hidden
      className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-xl"
    >
      {emoji}
    </span>
  );
}

/**
 * One moment of the feed of a league: its label, the player's bib, the sentence; under it,
 * `children` (the reactions, #672). Outside the league (the community block of the home, #673),
 * `leagueName` says which league it is from.
 */
export function MomentCard({
  moment,
  leagueName,
  children,
}: {
  moment: FeedMoment;
  leagueName?: string;
  children?: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
      <div className="flex items-start gap-3">
        <MomentIcon emoji={text.emoji[moment.kind]} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <ChipStatus tone={TONE[moment.kind]}>{text.label[moment.kind]}</ChipStatus>
            {leagueName && (
              <span className="min-w-0 break-words text-xs font-semibold text-muted-foreground">
                {leagueName}
              </span>
            )}
          </div>
          <p className="flex min-w-0 items-start gap-2 text-sm">
            {moment.bib && <Bib bib={moment.bib} />}
            <span className="min-w-0 break-words">{momentText(moment)}</span>
          </p>
          {moment.athletes && moment.athletes.length > 0 && (
            <MercatoAthletes athletes={moment.athletes} />
          )}
        </div>
      </div>
      {children}
    </article>
  );
}
