import Link from "next/link";

import { messages } from "@/app/messages.fr";
import type { ManagerIntroFigures } from "@/domain/manager-intro";

const text = messages.manager.intro;

export type ManagerIntroProps = {
  /** The figures quoted by the steps, from the rules of French Track Manager. */
  figures: ManagerIntroFigures;
  /** Where « Passer » leads: the Manager page without the presentation. */
  skipHref: string;
};

/**
 * The presentation of French Track Manager (#618, board « 1 bis »): on the night blue, five
 * numbered steps and the two ways in. Shown until the player has a Manager league.
 */
export function ManagerIntro({ figures, skipHref }: ManagerIntroProps) {
  return (
    <section
      aria-labelledby="manager-intro"
      className="flex flex-1 flex-col bg-nuit px-4 pb-8 pt-4 text-white"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-secondary">
            {text.eyebrow}
          </p>
          <Link
            href={skipHref}
            aria-label={text.skipLabel}
            className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-[#d9e4f5] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            {text.skip}
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          <h1
            id="manager-intro"
            className="break-words font-display text-4xl font-extrabold leading-none"
          >
            {messages.manager.title}
          </h1>
          <p className="break-words text-base leading-snug text-[#d9e4f5]">{text.tagline}</p>
        </div>
        <ol aria-label={text.stepsLabel} className="flex flex-col gap-2.5">
          {text.steps(figures).map((step, i) => (
            <li
              key={step.title}
              className="flex items-start gap-3 rounded-card border border-white/15 bg-white/5 p-3.5"
            >
              <span
                aria-hidden="true"
                className="flex size-9 flex-none items-center justify-center rounded-full bg-secondary font-display text-lg font-extrabold text-secondary-foreground"
              >
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="break-words font-bold">{step.title}</h2>
                <p className="break-words text-sm leading-snug text-[#d9e4f5]">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Link
            href="/manager/creer"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            {text.create}
          </Link>
          <Link
            href="/manager/rejoindre"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 px-6 py-2.5 font-semibold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            {text.haveCode}
          </Link>
        </div>
      </div>
    </section>
  );
}
