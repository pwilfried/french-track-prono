"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { messages } from "@/app/messages.fr";
import type { ManagerIntroFigures } from "@/domain/manager-intro";
import { cn } from "@/lib/utils";

const text = messages.manager.tutorial;

export type ManagerTutorialProps = {
  /** The figures the steps quote, from the rules of French Track Manager. */
  figures: ManagerIntroFigures;
  /** « Passer » or « C'est parti »: the tutorial is over. */
  onClose: () => void;
  /** The step shown first, from 0 (stories). */
  initialStep?: number;
};

/**
 * How French Track Manager works (#616, board « 11 · Tutoriel »): seven steps on the night blue,
 * one idea each with a drawing made of simple shapes, « Précédent » / « Suivant » (the arrow keys
 * too) and « Passer » from any step.
 */
export function ManagerTutorial({ figures, onClose, initialStep = 0 }: ManagerTutorialProps) {
  const steps = text.steps(figures);
  const [index, setIndex] = useState(initialStep);
  const go = (to: number) => setIndex(Math.min(Math.max(to, 0), steps.length - 1));
  const step = steps[index]!;
  const last = index === steps.length - 1;

  return (
    <section
      aria-label={text.label}
      // Focused when the dialog opens, so that « Passer » does not open with its focus ring on.
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(index + 1);
        if (event.key === "ArrowLeft") go(index - 1);
      }}
      className="flex flex-1 flex-col bg-nuit px-4 pb-8 pt-4 text-white outline-none"
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-secondary">
            {text.progress(index + 1, steps.length)}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={text.skipLabel}
            className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-[#d9e4f5] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            {text.skip}
          </button>
        </div>
        <Drawing step={index} />
        <div aria-live="polite" className="flex flex-col gap-2">
          <h2 className="break-words font-display text-3xl font-extrabold uppercase leading-none">
            {step.title}
          </h2>
          <p className="break-words text-base leading-snug text-[#d9e4f5]">{step.text}</p>
        </div>
        <ol className="flex justify-center gap-2">
          {steps.map((s, i) => (
            <li
              key={s.title}
              aria-current={i === index ? "step" : undefined}
              className={cn(
                "h-2 rounded-full transition-all motion-reduce:transition-none",
                i === index ? "w-6 bg-secondary" : "w-2 bg-white/30",
              )}
            >
              <span className="sr-only">{text.stepLabel(i + 1, steps.length)}</span>
            </li>
          ))}
        </ol>
        {/* Right under the content: no empty gap down to the bottom of the screen (#709). */}
        <nav aria-label={text.navLabel} className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 px-6 py-2.5 font-semibold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-40"
          >
            {text.previous}
          </button>
          {/* One button for « Suivant » and « C'est parti », so that the focus stays on it. */}
          <button
            type="button"
            onClick={last ? onClose : () => go(index + 1)}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            {last ? text.done : text.next}
          </button>
        </nav>
      </div>
    </section>
  );
}

/** The drawing of each step: bibs, cards, the stadium, bars, a trophy. Never a photo. */
function Drawing({ step }: { step: number }) {
  const card = "h-14 w-10 rounded-lg";
  const drawings = [
    // A league between friends: four bibs.
    <div key="league" className="grid grid-cols-2 gap-3">
      {["bg-brand", "bg-primary", "bg-secondary", "bg-success"].map((color) => (
        <span key={color} className={cn("h-9 w-12 rounded-md border-2 border-white/70", color)} />
      ))}
    </div>,
    // The mercato: cards face down, one turned over.
    <div key="mercato" className="flex items-end gap-3">
      <span className={cn(card, "border-2 border-white/40 bg-white/10")} />
      <span className={cn(card, "-rotate-6 bg-secondary")} />
      <span className={cn(card, "border-2 border-white/40 bg-white/10")} />
    </div>,
    // The team: a full set of cards.
    <div key="team" className="grid grid-cols-4 gap-1.5">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="h-8 w-6 rounded bg-secondary/90" />
      ))}
    </div>,
    // The lineup: the stadium, a track around a field, with the starters.
    <div
      key="lineup"
      className="flex h-28 w-48 items-center justify-center rounded-full border-[10px] border-track bg-field"
    >
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="size-3 rounded-full bg-secondary" />
        ))}
      </div>
    </div>,
    // The points: bars going up.
    <div key="points" className="flex h-24 items-end gap-3">
      {["h-1/3", "h-2/3", "h-full"].map((height) => (
        <span key={height} className={cn("w-8 rounded-t-md bg-success", height)} />
      ))}
    </div>,
    // A head-to-head: two bibs on each side of a line.
    <div key="match" className="flex items-center gap-5">
      <span className="h-10 w-14 rounded-md border-2 border-white/70 bg-brand" />
      <span className="h-16 w-0.5 bg-white/70" />
      <span className="h-10 w-14 rounded-md border-2 border-white/70 bg-primary" />
    </div>,
    // The champion: a trophy.
    <div key="champion" className="flex flex-col items-center">
      <span className="h-14 w-16 rounded-b-[2rem] rounded-t-md bg-secondary" />
      <span className="h-4 w-3 bg-secondary" />
      <span className="h-3 w-12 rounded-md bg-secondary" />
    </div>,
  ];
  return (
    <div
      aria-hidden="true"
      className="flex h-44 items-center justify-center rounded-card border border-white/15 bg-white/5"
    >
      {drawings[step]}
    </div>
  );
}

/** Remembered on the device: the tutorial opens by itself once (#616). */
const MANAGER_TUTORIAL_SEEN_KEY = "ftp:manager-tutorial-seen";

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
/** Seen during this visit, even where the storage cannot be written (private browsing). */
let seenNow = false;
const isSeen = () => {
  if (seenNow) return true;
  try {
    return localStorage.getItem(MANAGER_TUTORIAL_SEEN_KEY) === "1";
  } catch {
    return false;
  }
};
const markSeen = () => {
  seenNow = true;
  try {
    localStorage.setItem(MANAGER_TUTORIAL_SEEN_KEY, "1");
  } catch {
    // No storage: it stays closed for this visit only.
  }
  listeners.forEach((listener) => listener());
};

/**
 * The tutorial over the Manager page, in a modal dialog (Escape skips it): at the first visit,
 * or when `open` (« Comment ça marche ? », `/manager?tutoriel=1`). Closing it leaves the page
 * underneath, the presentation of the mode (#618) or the player's leagues.
 */
export function ManagerTutorialGate({
  figures,
  open = false,
}: {
  figures: ManagerIntroFigures;
  open?: boolean;
}) {
  // Seen on the server: a returning player never gets the dialog in the first HTML.
  const seen = useSyncExternalStore(subscribe, isSeen, () => true);
  const [closed, setClosed] = useState(false);
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const shown = !closed && (open || !seen);

  useEffect(() => {
    const current = dialog.current;
    if (!shown || !current || current.open) return;
    current.showModal();
    // The dialog would focus « Passer », its first button, with the focus ring on (#709).
    current.querySelector<HTMLElement>("section[tabindex]")?.focus();
  }, [shown]);

  if (!shown) return null;
  const close = () => {
    markSeen();
    setClosed(true);
    if (open) router.replace("/manager", { scroll: false });
  };
  return (
    <dialog
      ref={dialog}
      aria-label={text.label}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-nuit p-0 text-white backdrop:bg-nuit"
    >
      <div className="flex min-h-full flex-col">
        <ManagerTutorial figures={figures} onClose={close} />
      </div>
    </dialog>
  );
}
