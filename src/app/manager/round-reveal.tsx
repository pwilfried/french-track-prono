"use client";

import Link from "next/link";
import { useState } from "react";

import type { ManagerRoundReveal } from "@/application/manager-reveal";
import { messages } from "@/app/messages.fr";
import { RevealCard } from "@/components/manager/reveal-card";
import { RoundSummary } from "@/components/manager/round-summary";
import { buttonVariants } from "@/components/ui/button";

const text = messages.roundReveal;

/** A figure of the tally. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-semibold opacity-80">{label}</dt>
      <dd className="font-mono text-2xl font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The reveal of a closed round (#604), in two steps. First « L'heure de vérité », on night blue:
 * the player's bids face down, turned over one by one or all at once, then their tally. Then every
 * bid of the round. `step` "all" opens the second step directly (the summary read again from the
 * mercato).
 */
export function RoundReveal({
  leagueId,
  reveal,
  step: firstStep,
}: {
  leagueId: string;
  reveal: ManagerRoundReveal;
  step: "cards" | "all";
}) {
  const [step, setStep] = useState(firstStep);
  const [shown, setShown] = useState(0);
  const done = shown >= reveal.cards.length;
  const { tally } = reveal;

  if (step === "all") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <RoundSummary round={reveal.round} athletes={reveal.athletes} />
        <Link href={`/manager/${leagueId}/catalogue`} className={`${buttonVariants()} w-full`}>
          {text.backToMercato}
        </Link>
        <Link
          href={`/manager/${leagueId}/equipe`}
          className={`${buttonVariants({ variant: "muted" })} w-full`}
        >
          {text.seeTeam}
        </Link>
      </div>
    );
  }

  return (
    <section aria-labelledby="reveal-title" className="hero flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
        <div className="flex flex-col gap-1 text-center">
          <h1 id="reveal-title" className="font-display text-3xl font-extrabold">
            {text.title}
          </h1>
          <p className="text-sm font-semibold opacity-90">{text.subtitle(reveal.round)}</p>
        </div>
        {reveal.cards.length === 0 ? (
          <p className="rounded-card bg-white/10 p-4 text-center text-sm font-semibold">
            {text.noBid}
          </p>
        ) : (
          <ul aria-label={text.subtitle(reveal.round)} className="grid grid-cols-3 gap-3">
            {reveal.cards.map((card, i) => (
              <li key={card.athleteId}>
                <RevealCard card={card} revealed={i < shown} />
              </li>
            ))}
          </ul>
        )}
        {done ? (
          <>
            <section
              aria-labelledby="reveal-tally"
              className="flex flex-col gap-3 rounded-card bg-white/10 p-4"
            >
              <h2 id="reveal-tally" className="text-xs font-bold uppercase tracking-wide">
                {text.tally}
              </h2>
              <dl className="grid grid-cols-3 gap-3">
                <Figure label={text.tallyWon} value={text.ratio(tally.won, tally.placed)} />
                <Figure label={text.tallyAthletes} value={String(tally.athletes)} />
                <Figure label={text.tallyLeft} value={messages.catalogue.price(tally.left)} />
              </dl>
            </section>
            <button
              type="button"
              onClick={() => {
                setStep("all");
                window.scrollTo(0, 0);
              }}
              className={`${buttonVariants()} w-full`}
            >
              {text.seeAll}
            </button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setShown((n) => n + 1)}
              className={`${buttonVariants()} w-full`}
            >
              {text.revealNext}
            </button>
            <button
              type="button"
              onClick={() => setShown(reveal.cards.length)}
              className={`${buttonVariants({ variant: "muted" })} w-full`}
            >
              {text.revealAll}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
