import { messages } from "@/app/messages.fr";
import type { DuelCard } from "@/application/manager-duel";
import type { LineupPlace } from "@/domain/manager-lineup";

import { EmptySpot, PlacedSpot, StadiumMap } from "./stadium";

const text = messages.managerDuel;

export type DuelStadiumSide = {
  pseudo: string;
  linedUp: boolean;
  /** The side's score of the head-to-head; null until the competition is scored. */
  score?: number | null;
  /** One per place: null for an empty one. */
  cards: (DuelCard | null)[];
};

function Side({
  side,
  places,
  tone,
}: {
  side: DuelStadiumSide;
  places: LineupPlace[];
  tone: "gold" | "blue";
}) {
  const flipped = tone === "blue";
  const score = (
    <p className="flex items-baseline justify-between gap-3 rounded-xl bg-muted px-3 py-2 text-sm font-bold">
      <span className="min-w-0 break-words">{side.pseudo}</span>
      <span className="font-mono text-lg font-extrabold tabular-nums">
        {messages.managerChampionship.score(side.score ?? null)}
      </span>
    </p>
  );
  if (!side.linedUp) {
    return (
      <div className="flex flex-col gap-2">
        {score}
        <p className="rounded-xl bg-muted p-3 text-center text-sm font-semibold">
          {text.noLineup(side.pseudo)}
        </p>
      </div>
    );
  }
  const spots = places.map((place, i) => {
    const card = side.cards[i];
    const label = messages.lineup.place[place];
    return card ? (
      <PlacedSpot
        athlete={card}
        tone={tone}
        points={card.points}
        bonus={card.bonus}
        label={messages.team.scoredCardLabel(card.name, card.discipline, card.points, card.bonus)}
      />
    ) : (
      <EmptySpot label={label} fillable={false}>
        <span className="sr-only">{messages.lineup.emptyPlace(label)}</span>
      </EmptySpot>
    );
  });
  return (
    <div className="flex flex-col gap-2">
      {!flipped && score}
      <StadiumMap
        label={text.sideOf(side.pseudo)}
        places={places}
        spots={spots}
        flipped={flipped}
      />
      {flipped && score}
    </div>
  );
}

/**
 * The stadiums of a head-to-head (#605, #775): the opponent's stadium at the top, turned round
 * to face the player's below it, light blue cards against gold ones, each starter on their place as
 * in the lineup with their family, bonus, initials and points; between the two, each side's score.
 * An athlete at 0 has a dashed red frame.
 */
export function DuelStadium({
  places,
  top,
  bottom,
}: {
  places: LineupPlace[];
  top: DuelStadiumSide;
  bottom: DuelStadiumSide;
}) {
  return (
    <section aria-label={text.stadium} className="flex flex-col gap-3">
      <Side side={top} places={places} tone="blue" />
      <Side side={bottom} places={places} tone="gold" />
    </section>
  );
}
