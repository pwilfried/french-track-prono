"use client";

import { useEffect, useSyncExternalStore } from "react";

import { messages } from "@/app/messages.fr";
import { ANIMALS, animalChange, type Animal as AnimalName } from "@/domain/band";

import { Animal } from "./animal";

/** The last animal the player saw on this device (#768). */
export const ANIMAL_SEEN_KEY = "ftp:animal-seen";

/** Storage that cannot be read, or a notice closed during this visit: nothing to announce. */
const QUIET = "quiet";

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
/** Read once per visit, so the notice stays up while the new animal is being remembered. */
let seenAtArrival: string | null | undefined;
let closedNow = false;
const seenSnapshot = () => {
  if (closedNow) return QUIET;
  if (seenAtArrival === undefined) {
    try {
      seenAtArrival = localStorage.getItem(ANIMAL_SEEN_KEY);
    } catch {
      seenAtArrival = QUIET;
    }
  }
  return seenAtArrival;
};

const asAnimal = (value: string | null) =>
  (ANIMALS as readonly string[]).includes(value ?? "") ? (value as AnimalName) : null;

/**
 * « Tu es passé Guépard ! »: announced once, at the top of the profile, when the player's animal
 * differs from the last one this device saw. Remembered at once, closed with ×.
 */
export function AnimalChange({ animal }: { animal: AnimalName | null }) {
  const seen = useSyncExternalStore(subscribe, seenSnapshot, () => QUIET);
  useEffect(() => {
    if (!animal) return;
    try {
      localStorage.setItem(ANIMAL_SEEN_KEY, animal);
    } catch {
      // No storage: nothing is announced on this device anyway.
    }
  }, [animal]);

  const change = seen === QUIET ? null : animalChange(asAnimal(seen), animal);
  if (!change) return null;

  const close = () => {
    closedNow = true;
    listeners.forEach((listener) => listener());
  };
  const name = messages.band.animals[change.animal];
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-card bg-gold-soft p-3 text-gold-ink"
    >
      <Animal kind={change.animal} size="medium" />
      <p className="min-w-0 flex-1">
        <strong className="block font-display text-lg">
          {messages.band.became(name, change.first)}
        </strong>
        <span className="text-sm">{messages.band.becameHint}</span>
      </p>
      <button
        type="button"
        onClick={close}
        aria-label={messages.band.close}
        className="-mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-xl leading-none hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
