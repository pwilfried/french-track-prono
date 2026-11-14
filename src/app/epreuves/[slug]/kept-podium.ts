import { parseKeptPodium, type KeptPodium } from "@/domain/podium-draft";

// The podium being built lives in this tab only (#699): the storage may be missing (private
// window, quota), the page then simply works without it.
const keyOf = (eventId: string) => `podium-draft:${eventId}`;

export function readKeptPodium(eventId: string, knownIds: string[]): KeptPodium | null {
  try {
    return parseKeptPodium(sessionStorage.getItem(keyOf(eventId)), knownIds);
  } catch {
    return null;
  }
}

export function keepPodium(eventId: string, kept: KeptPodium): void {
  try {
    sessionStorage.setItem(keyOf(eventId), JSON.stringify(kept));
  } catch {
    // No storage: the podium is only lost if the player leaves the page.
  }
}

/** Once the prediction is saved or the event is locked, nothing is left to come back to. */
export function forgetPodium(eventId: string): void {
  try {
    sessionStorage.removeItem(keyOf(eventId));
  } catch {
    // No storage: nothing was kept.
  }
}
