import { messages } from "@/app/messages.fr";
import type { Podium } from "@/domain/podium-draft";

const MEDALS = [
  ["first", "🥇"],
  ["second", "🥈"],
  ["third", "🥉"],
] as const;

/** One player's podium, revealed after the lock. Mine is highlighted. */
export function RevealedPredictionCard({
  pseudo,
  avatar,
  podium,
  useJoker,
  mine,
  flair = false,
  nameOf,
  children,
}: {
  pseudo: string;
  avatar: string;
  podium: Podium;
  useJoker: boolean;
  mine: boolean;
  flair?: boolean;
  nameOf: (athleteId: string) => string;
  children?: React.ReactNode;
}) {
  return (
    <li
      className={`flex flex-col gap-2 rounded-card border p-3.5 ${
        mine ? "border-secondary bg-secondary/15" : "border-border bg-card"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5 font-bold">
        <span aria-hidden="true" className="text-2xl">
          {avatar}
        </span>
        <span className="min-w-0 flex-1 truncate">{mine ? messages.reveal.me : pseudo}</span>
        {flair && (
          <span className="shrink-0 rounded-full bg-success px-2 py-0.5 text-xs font-extrabold text-nuit">
            {messages.reveal.flair}
          </span>
        )}
        {useJoker && (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-extrabold text-secondary-foreground">
            {messages.reveal.joker}
          </span>
        )}
      </div>
      <ol className="flex flex-col gap-0.5">
        {MEDALS.map(([slot, medal]) => (
          <li key={slot} className="flex items-center gap-2">
            <span aria-hidden="true" className="w-6 text-center">
              {medal}
            </span>
            <span className="sr-only">{messages.reveal.places[slot]}</span>
            <span className="min-w-0 break-words">{nameOf(podium[slot])}</span>
          </li>
        ))}
      </ol>
      {flair && <p className="text-sm text-muted-foreground">{messages.reveal.flairLine}</p>}
      {children}
    </li>
  );
}
