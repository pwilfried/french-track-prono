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
export function momentText(moment: FeedMoment): string {
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
      return text.text.mercato_win(moment.pseudo, moment.athlete ?? null, moment.price ?? null);
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

/**
 * One moment of the feed of a league: its label, the player's bib, the sentence; under it,
 * `children` (the reactions, #672).
 */
export function MomentCard({ moment, children }: { moment: FeedMoment; children?: ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-xl"
        >
          {text.emoji[moment.kind]}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <ChipStatus tone={TONE[moment.kind]} className="self-start">
            {text.label[moment.kind]}
          </ChipStatus>
          <p className="flex min-w-0 items-start gap-2 text-sm">
            {moment.bib && <Bib bib={moment.bib} />}
            <span className="min-w-0 break-words">{momentText(moment)}</span>
          </p>
        </div>
      </div>
      {children}
    </article>
  );
}
