import { messages } from "@/app/messages.fr";
import type { DuelCard } from "@/application/manager-duel";
import type { LineupPlace } from "@/domain/manager-lineup";
import { cn } from "@/lib/utils";

import { EmptySpot, PlacedSpot, StadiumMap } from "./stadium";

const text = messages.managerDuel;
const score = messages.managerChampionship.score;

export type DuelStadiumSide = {
  pseudo: string;
  linedUp: boolean;
  /** The side's score of the head-to-head; null until the competition is scored. */
  score?: number | null;
  /** One per place: null for an empty one. */
  cards: (DuelCard | null)[];
};

/** Whether the card of a place beats the card on the same place of the other stadium. */
function wins(card: DuelCard | null | undefined, other: DuelCard | null | undefined): boolean {
  return card?.points != null && other?.points != null && card.points > other.points;
}

function Title({ title, value, leads }: { title: string; value: string; leads: boolean }) {
  return (
    <h2 className="flex items-baseline justify-between gap-3 font-display text-2xl font-extrabold leading-tight text-nuit dark:text-foreground">
      <span className="min-w-0 break-words">{title}</span>
      <span className={cn("font-mono tabular-nums", leads && "text-accent-text")}>{value}</span>
    </h2>
  );
}

function Stadium({
  side,
  other,
  places,
}: {
  side: DuelStadiumSide;
  other: DuelStadiumSide;
  places: LineupPlace[];
}) {
  if (!side.linedUp) {
    return (
      <p className="rounded-xl bg-muted p-3 text-center text-sm font-semibold">
        {text.noLineup(side.pseudo)}
      </p>
    );
  }
  const spots = places.map((place, i) => {
    const card = side.cards[i];
    const label = messages.lineup.place[place];
    return card ? (
      <PlacedSpot
        athlete={card}
        points={card.points}
        won={other.linedUp && wins(card, other.cards[i])}
        label={messages.team.scoredCardLabel(card.name, card.discipline, card.points, card.bonus)}
      />
    ) : (
      <EmptySpot label={label} fillable={false}>
        <span className="sr-only">{messages.lineup.emptyPlace(label)}</span>
      </EmptySpot>
    );
  });
  return <StadiumMap label={text.sideOf(side.pseudo)} places={places} spots={spots} />;
}

/**
 * « Confrontation stade contre stade » (#605, #775), as in the validated mock-up: the opponent's
 * stadium at the top with their score in night blue, the player's below (« Mon stade », the score in red when it leads), the score between the
 * two on a night blue pill. Both stadiums have the same places as the lineup: races on gold
 * cards, field events on white ones, each with the athlete's points or « à venir »; « ▲ » and a
 * thick frame for the card that wins the duel of its place.
 */
export function DuelStadium({
  places,
  top,
  bottom,
  mine = false,
}: {
  places: LineupPlace[];
  top: DuelStadiumSide;
  bottom: DuelStadiumSide;
  /** The player plays it: the bottom stadium is « Mon stade ». */
  mine?: boolean;
}) {
  const topScore = top.score ?? null;
  const bottomScore = bottom.score ?? null;
  const leads = (a: number | null, b: number | null) => a !== null && b !== null && a > b;
  return (
    <section aria-label={text.stadium} className="flex flex-col gap-3">
      <Title title={text.stadiumOf(top.pseudo)} value={score(topScore)} leads={false} />
      <Stadium side={top} other={bottom} places={places} />
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="rounded-full bg-nuit px-5 py-1.5 font-mono text-2xl font-extrabold tabular-nums text-secondary ring-1 ring-white/10">
          {text.scoreLine(score(topScore), score(bottomScore))}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Stadium side={bottom} other={top} places={places} />
      <Title
        title={mine ? text.myStadium : text.stadiumOf(bottom.pseudo)}
        value={score(bottomScore)}
        leads={leads(bottomScore, topScore)}
      />
      <p className="text-sm text-muted-foreground">{text.legend}</p>
    </section>
  );
}
