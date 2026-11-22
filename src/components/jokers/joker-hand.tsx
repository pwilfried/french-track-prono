"use client";

import type { ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import type { ErrorCode } from "@/application/errors";
import { cn } from "@/lib/utils";

const text = messages.jokerHand;

/** One card of a hand: a joker, with its emoji and name. */
export type HandCard = {
  id: string;
  emoji: string;
  name: string;
  /** Not playable here: played already, or away from home. Hatched, with its own emoji and label. */
  off?: { emoji: string; label: string };
};

/**
 * A hand of joker cards (#1121), for the predictions and the Manager: touch a free card to put it
 * down, touch it again to take it back. A card played already is hatched and disabled. While a
 * choice is sent, every card waits; a refusal shows under the hand.
 */
export function JokerHand({
  cards,
  placed,
  onPlace,
  pending = false,
  frozen = false,
  error,
  explain,
  children,
}: {
  cards: HandCard[];
  /** The id of the card put down, if any. */
  placed: string | null;
  /** Puts a card down, or takes it back (null). */
  onPlace: (id: string | null) => void;
  /** A choice is being sent: nothing can be touched. */
  pending?: boolean;
  /** Nothing changes any more (locked, or a card that never comes back). */
  frozen?: boolean;
  error?: ErrorCode | null;
  /** What the card put down does. */
  explain?: ReactNode;
  /** Under the explanation: what the card put down still needs (its target). */
  children?: ReactNode;
}) {
  const inHand = cards.filter((c) => !c.off && c.id !== placed).length;
  const down = cards.find((c) => c.id === placed);
  return (
    <div className="flex flex-col gap-2" aria-busy={pending || undefined}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-bold">{text.title}</span>
        <span className="text-muted-foreground">{text.count(inHand)}</span>
      </div>
      <ul className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-1.5 pt-2">
        {cards.map((card) => {
          const isDown = card.id === placed;
          return (
            <li key={card.id} className="flex">
              <button
                type="button"
                aria-pressed={isDown}
                disabled={!!card.off || pending || frozen}
                onClick={() => onPlace(isDown ? null : card.id)}
                className={cn(
                  "flex min-h-[86px] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 px-0.5 py-2 text-center transition-[translate,rotate] focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none",
                  card.off
                    ? "border-border bg-[repeating-linear-gradient(135deg,var(--muted)_0_5px,transparent_5px_10px)] text-muted-foreground"
                    : isDown
                      ? "-translate-y-1.5 -rotate-4 animate-card-pop border-[var(--medal-gold-to)] bg-gold-soft text-gold-ink shadow-lg motion-reduce:animate-none"
                      : "border-foreground bg-card text-foreground shadow-[0_3px_0_var(--foreground)]",
                  (pending || frozen) && !card.off && "cursor-default",
                  pending && "opacity-70",
                )}
              >
                <span aria-hidden className="text-[26px] leading-none">
                  {card.off?.emoji ?? card.emoji}
                </span>
                <span className="w-full text-[11px] leading-tight font-bold break-words hyphens-auto">
                  {card.name}
                </span>
                {card.off && (
                  <span className="text-[11px] leading-tight font-semibold">{card.off.label}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {down ? (
        <div className="flex gap-3 rounded-2xl bg-gold-soft p-3 text-gold-ink">
          <span aria-hidden className="text-[30px] leading-none">
            {down.emoji}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-extrabold break-words">{text.placed(down.name)}</p>
            {explain && <p className="text-sm">{explain}</p>}
            {children}
          </div>
        </div>
      ) : (
        !frozen && <p className="text-sm text-muted-foreground">{text.hint}</p>
      )}
      {pending && (
        <p role="status" className="text-sm text-muted-foreground">
          {text.sending}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[error]}
        </p>
      )}
    </div>
  );
}
