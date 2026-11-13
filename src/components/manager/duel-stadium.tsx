import { messages } from "@/app/messages.fr";
import type { DuelCard } from "@/application/manager-duel";
import type { LineupPlace } from "@/domain/manager-lineup";

import { AthleteCard } from "./athlete-card";
import { EmptyPlace, STADIUM_GRID, Stadium } from "./stadium";

const text = messages.managerDuel;

export type DuelStadiumSide = {
  pseudo: string;
  linedUp: boolean;
  /** One per place: null for an empty one. */
  cards: (DuelCard | null)[];
};

function Half({
  side,
  places,
  tone,
}: {
  side: DuelStadiumSide;
  places: LineupPlace[];
  tone: "gold" | "blue";
}) {
  if (!side.linedUp) {
    return (
      <p className="rounded-xl bg-black/20 p-3 text-center text-sm font-semibold text-field-foreground">
        {text.noLineup(side.pseudo)}
      </p>
    );
  }
  return (
    <ul aria-label={text.sideOf(side.pseudo)} className={STADIUM_GRID}>
      {places.map((place, i) => {
        const card = side.cards[i];
        const label = messages.lineup.place[place];
        return (
          <li key={i}>
            {card ? (
              <AthleteCard
                athlete={card}
                score={{ points: card.points, bonus: card.bonus }}
                tone={tone}
                compact
              />
            ) : (
              <EmptyPlace
                label={label}
                className="border-white/30 bg-black/20 text-field-foreground/70"
              >
                <span className="sr-only">{messages.lineup.emptyPlace(label)}</span>
              </EmptyPlace>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The stadium of a head-to-head (#605): one field cut by a white line, the opponent's starters at
 * the top on light blue cards, the player's at the bottom on gold ones, each on their place as in
 * the lineup, with their family, bonus, initials, short name and points. An athlete at 0 has a
 * dashed red frame.
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
    <section aria-label={text.stadium}>
      <Stadium className="flex flex-col gap-3">
        <Half side={top} places={places} tone="blue" />
        <hr aria-hidden className="border-t-2 border-white" />
        <Half side={bottom} places={places} tone="gold" />
      </Stadium>
    </section>
  );
}
