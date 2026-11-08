"use client";

import { useState, useSyncExternalStore } from "react";

import { messages } from "../../messages.fr";

const KEY = "ftp-first-prediction-tips";
const noSubscription = () => () => {};

const seen = () => {
  try {
    return window.localStorage.getItem(KEY) === "done";
  } catch {
    return false;
  }
};
const remember = () => {
  try {
    window.localStorage.setItem(KEY, "done");
  } catch {
    // Without storage the tips may come back: harmless.
  }
};

/** Three short tips above the first podium a player composes; skipped or read, they never return. */
export function FirstPredictionTips() {
  // The server renders nothing; the browser shows the tips when they were not seen yet.
  const alreadySeen = useSyncExternalStore(noSubscription, seen, () => true);
  const [step, setStep] = useState<number | null>(0);
  if (alreadySeen || step === null) return null;

  const steps = messages.tips.steps;
  const close = () => {
    remember();
    setStep(null);
  };
  const last = step === steps.length - 1;

  return (
    <section
      aria-label={messages.tips.label}
      aria-live="polite"
      className="mx-4 flex flex-col gap-2 rounded-2xl bg-brand px-4 py-3 text-brand-foreground"
    >
      <p className="font-mono text-xs font-bold opacity-80">
        {messages.tips.count(step + 1, steps.length)}
      </p>
      <p className="font-semibold">{steps[step]}</p>
      <div className="flex justify-end gap-2">
        {!last && (
          <button
            type="button"
            onClick={close}
            className="min-h-11 px-3 text-sm font-semibold underline"
          >
            {messages.tips.skip}
          </button>
        )}
        <button
          type="button"
          onClick={() => (last ? close() : setStep(step + 1))}
          className="min-h-11 rounded-full bg-white px-4 text-sm font-bold text-brand"
        >
          {last ? messages.tips.done : messages.tips.next}
        </button>
      </div>
    </section>
  );
}
