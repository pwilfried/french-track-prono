import { messages } from "@/app/messages.fr";
import type { DuelCard } from "@/application/manager-duel";
import type { LineupPlace } from "@/domain/manager-lineup";
import { cn } from "@/lib/utils";

import type { DuelStadiumSide } from "./duel-stadium";

const text = messages.managerDuel;

/** What happened on a place: who came in for whom and why, or nobody could (#1036). */
export function placeNote(card: DuelCard): string | null {
  const r = card.replaced;
  if (r?.reason === "tactical") {
    return text.tacticalNote(r.starterName, r.starterMark, r.threshold, card.name, r.gain);
  }
  if (r) return text.forfeitNote(r.starterName, r.starterStatus, card.name, r.reason === "forfeit");
  if (card.points !== null && card.mark === null) return text.nobodyNote(card.name, card.status);
  return null;
}

/**
 * « Place par place » (#1036), under the stadiums of a scored head-to-head: for each place, its
 * discipline, the athlete who counted for the player with their mark and bonuses, their points
 * against the opponent's, « ▲ » on the winner; under a place where a substitute counted, what
 * happened.
 */
export function DuelPlaces({
  places,
  mine,
  theirs,
}: {
  places: LineupPlace[];
  /** The player's side (the bottom one). */
  mine: DuelStadiumSide;
  theirs: DuelStadiumSide;
}) {
  return (
    <section aria-labelledby="duel-places" className="flex flex-col gap-2">
      <h2
        id="duel-places"
        className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
      >
        {text.places}
      </h2>
      <ol aria-labelledby="duel-places" className="flex flex-col gap-2">
        {places.map((place, i) => {
          const card = mine.cards[i] ?? null;
          const other = theirs.linedUp ? (theirs.cards[i] ?? null) : null;
          const myPoints = card?.points ?? 0;
          const theirPoints = other?.points ?? 0;
          const won = card !== null && myPoints > theirPoints;
          const lost = theirPoints > myPoints;
          const note = card && placeNote(card);
          return (
            <li
              key={i}
              aria-label={card ? `${messages.lineup.place[place]} : ${card.name}` : undefined}
              className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-2.5"
            >
              <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                    {card?.discipline ?? messages.lineup.place[place]}
                  </span>
                  {card ? (
                    <>
                      <span className="break-words font-semibold">
                        {card.name}
                        {card.replaced && ` ${text.replacedMark[card.replaced.reason]}`}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {text.mark(card.mark, card.status)}
                      </span>
                      {card.bonuses.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {card.bonuses.map((b) => (
                            <span
                              key={b.bonus}
                              className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold-ink"
                            >
                              {text.bonusTag(b.bonus, b.points)}
                            </span>
                          ))}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">{text.emptyPlace}</span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 font-mono tabular-nums">
                  <span
                    className={cn("text-xl font-extrabold", won && "text-gold-ink")}
                    aria-label={card ? text.placeMine(card.name, myPoints) : undefined}
                  >
                    {myPoints}
                    {won && ` ${text.won}`}
                  </span>
                  <span
                    className={cn("text-xs text-muted-foreground", lost && "font-bold")}
                    aria-label={text.placeTheirs(theirs.pseudo, theirPoints)}
                  >
                    {theirPoints}
                    {lost && ` ${text.won}`}
                  </span>
                </div>
              </div>
              {note && <p className="text-xs text-muted-foreground">{note}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
