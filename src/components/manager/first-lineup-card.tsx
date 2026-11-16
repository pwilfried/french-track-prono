"use client";

import Link from "next/link";
import { useState } from "react";

import { messages } from "@/app/messages.fr";
import { FIRST_LINEUP_STEPS, type FirstLineupStep } from "@/domain/manager-build";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";

const text = messages.lineup.first;

export type FirstLineupCardProps = {
  done: Record<FirstLineupStep, boolean>;
  current: FirstLineupStep | null;
  /** The match sheet of the next competition, where the current step is done. */
  href: string | null;
  rulesLines: string[];
};

/**
 * « Ton premier alignement » (#1037): four steps ticked as the player goes, a button to the
 * current one, and « Comment sont calculés les points ? » in a sheet over the page.
 */
export function FirstLineupCard({ done, current, href, rulesLines }: FirstLineupCardProps) {
  const [rules, setRules] = useState(false);
  return (
    <section
      aria-labelledby="first-lineup"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="first-lineup" className="text-base font-bold">
          {text.title}
        </h2>
        <p className="text-sm text-muted-foreground">{text.subtitle}</p>
      </div>
      <ol className="flex flex-col gap-1.5">
        {FIRST_LINEUP_STEPS.map((step, i) => (
          <li
            key={step}
            aria-current={step === current ? "step" : undefined}
            aria-label={(done[step] ? text.done : text.todo)(text.steps[step])}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold",
              step === current ? "bg-gold-soft text-gold-ink" : "bg-muted",
              done[step] && "bg-success-soft text-success-ink",
            )}
          >
            <span aria-hidden="true" className="w-4 text-center font-mono font-bold">
              {done[step] ? "✓" : i + 1}
            </span>
            <span className="min-w-0 flex-1 break-words">
              {text.steps[step]}
              {step === "tactical" && <span className="font-normal"> ({text.optional})</span>}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">{text.forgot}</p>
      {href && current && (
        <Link
          href={href}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 font-bold text-primary-foreground"
        >
          {text.go}
        </Link>
      )}
      <button
        type="button"
        onClick={() => setRules(true)}
        className="inline-flex min-h-11 items-center justify-center text-sm font-bold underline underline-offset-4"
      >
        {text.rules}
      </button>
      <BottomSheet open={rules} onClose={() => setRules(false)} title={text.rulesTitle}>
        <ul className="flex flex-col gap-3 px-4 pb-6 text-sm">
          {rulesLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </BottomSheet>
    </section>
  );
}
