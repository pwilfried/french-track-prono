import { messages } from "@/app/messages.fr";
import type { Animal as AnimalName, BandPoints as BandPointsValue } from "@/domain/band";

import { Animal } from "./animal";

const text = messages.band;

/**
 * « Ma bande » (#768): the season's points per family of the band, as bars next to each animal,
 * the player's animal marked, and the next animal within reach.
 */
export function BandPoints({
  band,
  animal,
  toReach,
}: {
  band: BandPointsValue[];
  animal: AnimalName | null;
  toReach: { animal: AnimalName; points: number } | null;
}) {
  const top = Math.max(1, ...band.map((b) => b.points));
  return (
    <section aria-labelledby="band" className="flex flex-col gap-2">
      <h2 id="band" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {text.title}
      </h2>
      <ul className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
        {band.map((b) => {
          const mine = b.animal === animal;
          return (
            <li key={b.animal} data-mine={mine} className="flex items-center gap-3">
              <Animal kind={b.animal} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 break-words">
                    <strong>{text.animals[b.animal]}</strong>{" "}
                    <span className="text-muted-foreground">· {text.families[b.animal]}</span>
                  </span>
                  <strong className="shrink-0 font-mono">
                    {b.points} {messages.format.ptsUnit(b.points)}
                  </strong>
                </span>
                <span aria-hidden="true" className="h-2 rounded-full bg-muted">
                  <span
                    className={`block h-2 rounded-full ${mine ? "bg-secondary" : "bg-brand dark:bg-foreground/70"}`}
                    style={{ width: `${(b.points / top) * 100}%` }}
                  />
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="rounded-card bg-muted p-3 text-sm font-semibold">
        {toReach
          ? text.toReach(
              toReach.points,
              text.families[toReach.animal],
              text.animals[toReach.animal],
            )
          : animal
            ? text.becameHint
            : text.noAnimalHint}
      </p>
    </section>
  );
}
