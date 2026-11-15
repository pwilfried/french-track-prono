"use client";

import { useState, useSyncExternalStore } from "react";

import { messages } from "@/app/messages.fr";
import { competitionDay } from "@/domain/competition";
import { closedToday, type FunFact, type FunFactTag } from "@/domain/fun-facts";
import { cn } from "@/lib/utils";

const text = messages.funFacts;

/** The day the player closed the card, remembered on the device: it comes back the next day. */
export const FUN_FACT_CLOSED_KEY = "ftp:fun-fact-closed-on";

const TAG_STYLE: Record<FunFactTag, string> = {
  predictions: "bg-brand-soft text-brand-ink",
  oddity: "bg-gold-soft text-gold-ink",
  bar: "bg-success-soft text-success-ink",
};

const subscribe = (listener: () => void) => {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
};
const readClosedOn = () => {
  try {
    return localStorage.getItem(FUN_FACT_CLOSED_KEY);
  } catch {
    return null;
  }
};
/** On the server the day the player closed it is unknown: nothing is shown until the browser says. */
const SERVER_CLOSED = "server";

export type FunFactCardProps = {
  /** In the order of the day (src/domain/fun-facts.ts); empty: no card. */
  facts: FunFact[];
  /** Today, Paris time (YYYY-MM-DD); by default the device's clock. */
  today?: string;
};

/**
 * « Le saviez-vous ? » (#766): one short fact at the top of the home, its tag, « Un autre » to see
 * the next one, × to close it until the next day. Never in the way: one tap closes it.
 */
export function FunFactCard({ facts, today }: FunFactCardProps) {
  const closedOn = useSyncExternalStore(subscribe, readClosedOn, () => SERVER_CLOSED);
  const [closedNow, setClosedNow] = useState(false);
  const [index, setIndex] = useState(0);
  const day = today ?? competitionDay(new Date().toISOString());

  if (facts.length === 0 || closedNow || closedOn === SERVER_CLOSED) return null;
  if (closedToday(closedOn, day)) return null;

  const fact = facts[index % facts.length]!;
  const close = () => {
    setClosedNow(true);
    try {
      localStorage.setItem(FUN_FACT_CLOSED_KEY, day);
    } catch {
      // No storage (private browsing): the card closes for this visit only.
    }
  };

  return (
    <section
      aria-labelledby="fun-fact-heading"
      className="flex flex-col gap-2 rounded-card border border-border bg-card/90 p-4 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="fun-fact-heading"
          className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
        >
          {text.heading}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label={text.close}
          className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-xl leading-none text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div aria-live="polite">
        <div key={fact.id} className="flex flex-col gap-1.5 motion-safe:animate-fact-in">
          <span
            className={cn(
              "self-start rounded-full px-2.5 py-1 text-xs font-bold",
              TAG_STYLE[fact.tag],
            )}
          >
            {text.tag[fact.tag]}
          </span>
          <h3 className="text-base font-bold text-foreground [overflow-wrap:anywhere]">
            {fact.title}
          </h3>
          <p className="text-sm text-foreground/85 [overflow-wrap:anywhere]">{fact.body}</p>
        </div>
      </div>
      {facts.length > 1 ? (
        <button
          type="button"
          onClick={() => setIndex((i) => i + 1)}
          className="-ml-2 inline-flex min-h-11 items-center self-start rounded-full px-2 text-sm font-bold text-brand-ink underline underline-offset-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {text.another}
        </button>
      ) : null}
    </section>
  );
}
