"use client";

import { useSyncExternalStore } from "react";

import { messages } from "@/app/messages.fr";

import { HowItWorks, type HowItWorksProps } from "./how-it-works";

/** Remembered on the device: once closed, the steps stay closed (#526). */
export const HOW_IT_WORKS_DISMISSED_KEY = "ftp:how-it-works-dismissed";

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
/** Closed during this visit, even where the storage cannot be written (private browsing). */
let closedNow = false;
const isDismissed = () => {
  if (closedNow) return true;
  try {
    return localStorage.getItem(HOW_IT_WORKS_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

/** « Comment ça marche » on the player's home, three steps on one line and a × to close them. */
export function DismissibleHowItWorks(props: Omit<HowItWorksProps, "compact" | "action">) {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => false);
  if (dismissed) return null;

  const dismiss = () => {
    closedNow = true;
    try {
      localStorage.setItem(HOW_IT_WORKS_DISMISSED_KEY, "1");
    } catch {
      // No storage: the steps close for this visit only.
    }
    listeners.forEach((listener) => listener());
  };

  return (
    <HowItWorks
      {...props}
      compact
      action={
        <button
          type="button"
          onClick={dismiss}
          aria-label={messages.howItWorks.dismiss}
          className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-xl leading-none text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true">×</span>
        </button>
      }
    />
  );
}
