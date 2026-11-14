"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { messages } from "@/app/messages.fr";
import { cn } from "@/lib/utils";

const text = messages.manager.tutorial;
const steps = text.steps;

const primary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2.5 text-center font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";
const outline =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 px-6 py-2.5 text-center font-semibold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-40";

export type ManagerTutorialProps = {
  /** « Passer »: the presentation is over, the player stays on the page. */
  onClose: () => void;
  /** « Créer » or « Rejoindre » on the last screen: the player leaves for it. */
  onLeave: () => void;
  /** The screen shown first, from 0 (stories). */
  initialStep?: number;
};

/**
 * How French Track Manager works (#616, #802): three screens on the night blue, the principle,
 * the season and the way in, each with a drawing made of simple shapes and no figure (they are in
 * the rules of the league). « Précédent » / « Suivant » (the arrow keys too), « Passer » from any
 * screen; the last one ends on « Créer une ligue Manager » and « Rejoindre avec un code ».
 */
export function ManagerTutorial({ onClose, onLeave, initialStep = 0 }: ManagerTutorialProps) {
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
        {last && (
          <div className="flex flex-col gap-2">
            <Link href="/manager/creer" onClick={onLeave} className={primary}>
              {messages.manager.create}
            </Link>
            <Link href="/manager/rejoindre" onClick={onLeave} className={outline}>
              {messages.manager.joinWithCode}
            </Link>
          </div>
        )}
        {/* Right under the content: no empty gap down to the bottom of the screen (#709). */}
        <nav
          aria-label={text.navLabel}
          className={cn("grid gap-2", last ? "grid-cols-1" : "grid-cols-2")}
        >
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className={outline}
          >
            {text.previous}
          </button>
          {!last && (
            <button type="button" onClick={() => go(index + 1)} className={primary}>
              {text.next}
            </button>
          )}
        </nav>
      </div>
    </section>
  );
}

/** The drawing of each screen: the stadium, the cards, the bibs. Never a photo. */
function Drawing({ step }: { step: number }) {
  const card = "h-14 w-10 rounded-lg";
  const drawings = [
    // The principle: the stadium, a track around a field, with the starters.
    <div
      key="principle"
      className="flex h-28 w-48 items-center justify-center rounded-full border-[10px] border-track bg-field"
    >
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="size-3 rounded-full bg-secondary" />
        ))}
      </div>
    </div>,
    // The season: the mercato cards, one turned over, then a head-to-head.
    <div key="season" className="flex items-center gap-5">
      <div className="flex items-end gap-2">
        <span className={cn(card, "border-2 border-white/40 bg-white/10")} />
        <span className={cn(card, "-rotate-6 bg-secondary")} />
      </div>
      <span className="h-16 w-0.5 bg-white/70" />
      <div className="flex flex-col gap-2">
        <span className="h-7 w-12 rounded-md border-2 border-white/70 bg-brand" />
        <span className="h-7 w-12 rounded-md border-2 border-white/70 bg-primary" />
      </div>
    </div>,
    // The way in: a league between friends, four bibs.
    <div key="league" className="grid grid-cols-2 gap-3">
      {["bg-brand", "bg-primary", "bg-secondary", "bg-success"].map((color) => (
        <span key={color} className={cn("h-9 w-12 rounded-md border-2 border-white/70", color)} />
      ))}
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
 * The presentation over the Manager page, in a modal dialog (Escape skips it): at the first
 * visit, or when `open` (« Comment ça marche ? », `/manager?tutoriel=1`). Closing it leaves the
 * page underneath, « Créer ou rejoindre une ligue » or the player's leagues.
 */
export function ManagerTutorialGate({ open = false }: { open?: boolean }) {
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
        <ManagerTutorial onClose={close} onLeave={markSeen} />
      </div>
    </dialog>
  );
}
