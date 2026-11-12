"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { messages } from "@/app/messages.fr";

const CardState = createContext<{ open: boolean; toggle: () => void; cardId: string } | null>(null);

/** A ranking row that can show the player's card under it, full width (#342). */
export function RankingItem({
  id,
  className,
  current,
  cardId,
  card,
  children,
}: {
  id?: string;
  className: string;
  current: boolean;
  cardId: string;
  card: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <CardState.Provider value={{ open, toggle: () => setOpen((value) => !value), cardId }}>
      <li id={id} aria-current={current ? "true" : undefined} className={className}>
        <div className="flex min-h-14 items-center gap-2.5">{children}</div>
        {open ? <div className="pb-1.5">{card}</div> : null}
      </li>
    </CardState.Provider>
  );
}

/** The pseudo in a ranking row: a button that opens or closes the player's card. */
export function PlayerName({ pseudo, children }: { pseudo: string; children: ReactNode }) {
  const state = useContext(CardState);
  return (
    <button
      type="button"
      aria-expanded={state?.open ?? false}
      aria-controls={state?.open ? state.cardId : undefined}
      aria-label={messages.playerCard.open(pseudo)}
      onClick={state?.toggle}
      className="min-h-11 text-left font-bold underline-offset-4 hover:underline focus-visible:underline [overflow-wrap:anywhere]"
    >
      {children}
    </button>
  );
}
