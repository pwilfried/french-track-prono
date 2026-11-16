"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { messages } from "@/app/messages.fr";
import { cn } from "@/lib/utils";

const text = messages.catalogue.firstMercato;

const primary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2.5 text-center font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";
const outline =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 px-6 py-2.5 text-center font-semibold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-40";

/** What the four cards quote from the rules of the league. */
export type FirstMercatoRules = {
  budget: number;
  perFamily: number;
  starters: number;
  bench: number;
};

export type FirstMercatoCardsProps = {
  rules: FirstMercatoRules;
  /** « Passer » or the end of the last card. */
  onClose: () => void;
  /** The card shown first, from 0 (stories). */
  initialStep?: number;
};

/** The four cards of the first mercato (#1037): « Premier mercato · N sur 4 », Passer / Suivant. */
export function FirstMercatoCards({ rules, onClose, initialStep = 0 }: FirstMercatoCardsProps) {
  const [index, setIndex] = useState(initialStep);
  const total = text.steps.length;
  const last = index === total - 1;
  const step = text.steps[index]!;
  const body = [
    text.steps[0].text(rules.budget),
    text.steps[1].text(),
    text.steps[2].text(rules.perFamily),
    text.steps[3].text(rules.starters, rules.bench),
  ][index]!;

  return (
    <section
      aria-label={text.label}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") setIndex(Math.min(index + 1, total - 1));
        if (event.key === "ArrowLeft") setIndex(Math.max(index - 1, 0));
      }}
      className="flex flex-col gap-5 bg-nuit px-4 pb-6 pt-4 text-white outline-none"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-secondary">
          {text.progress(index + 1, total)}
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
      <div aria-live="polite" className="flex flex-col gap-2">
        <h2 className="break-words font-display text-3xl font-extrabold uppercase leading-none">
          {step.title}
        </h2>
        <p className="break-words text-base leading-snug text-[#d9e4f5]">{body}</p>
      </div>
      <ol className="flex justify-center gap-2" aria-hidden="true">
        {text.steps.map((s, i) => (
          <li
            key={s.title}
            className={cn(
              "h-2 rounded-full transition-all motion-reduce:transition-none",
              i === index ? "w-6 bg-secondary" : "w-2 bg-white/30",
            )}
          />
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setIndex(index - 1)}
          disabled={index === 0}
          className={outline}
        >
          {text.previous}
        </button>
        <button
          type="button"
          onClick={last ? onClose : () => setIndex(index + 1)}
          className={primary}
        >
          {last ? text.done : text.next}
        </button>
      </div>
    </section>
  );
}

/** Remembered on the device: the guide opens by itself once, in any league (#1037). */
export const FIRST_MERCATO_SEEN_KEY = "ftp:manager-first-mercato-seen";

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
let seenNow = false;
const isSeen = () => {
  if (seenNow) return true;
  try {
    return localStorage.getItem(FIRST_MERCATO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
};
const markSeen = () => {
  seenNow = true;
  try {
    localStorage.setItem(FIRST_MERCATO_SEEN_KEY, "1");
  } catch {
    // No storage: it stays closed for this visit only.
  }
  listeners.forEach((listener) => listener());
};

export type FirstMercatoGateProps = {
  rules: FirstMercatoRules;
  /** Asked for from « Comment ça marche ? »: `?guide=1`. */
  open?: boolean;
  /** Where closing a guide that was asked for leads back to. */
  returnHref: string;
};

/**
 * The guide over the catalogue, in a modal dialog (Escape skips it): the first time a player opens
 * a catalogue on this device, or when `open`.
 */
export function FirstMercatoGate({ rules, open = false, returnHref }: FirstMercatoGateProps) {
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
    current.querySelector<HTMLElement>("section[tabindex]")?.focus();
  }, [shown]);

  if (!shown) return null;
  const close = () => {
    markSeen();
    setClosed(true);
    if (open) router.replace(returnHref, { scroll: false });
  };
  return (
    <dialog
      ref={dialog}
      aria-label={text.label}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-card border-0 bg-nuit p-0 text-white backdrop:bg-black/60"
    >
      <FirstMercatoCards rules={rules} onClose={close} />
    </dialog>
  );
}
