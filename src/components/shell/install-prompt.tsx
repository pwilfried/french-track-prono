"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { messages } from "@/app/messages.fr";
import { shouldOfferInstall } from "@/domain/install-prompt";

/** The browser event that lets a page offer "add to home screen" (Chrome, Edge, Android). */
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<unknown> };

export const SESSIONS_KEY = "ftp.sessions";
export const DISMISSED_KEY = "ftp.install.dismissed";
const SESSION_FLAG = "ftp.session";

/** Storage can throw (private mode, blocked site data): the offer is then simply not shown. */
function countThisVisit(): { sessions: number; dismissed: boolean } {
  try {
    let sessions = Number(localStorage.getItem(SESSIONS_KEY) ?? "0") || 0;
    if (!sessionStorage.getItem(SESSION_FLAG)) {
      sessions += 1;
      localStorage.setItem(SESSIONS_KEY, String(sessions));
      sessionStorage.setItem(SESSION_FLAG, "1");
    }
    return { sessions, dismissed: localStorage.getItem(DISMISSED_KEY) === "1" };
  } catch {
    return { sessions: 0, dismissed: true };
  }
}

/** The discreet banner itself, at the bottom of the screen above the navigation bar. */
export function InstallBanner({
  onInstall,
  onDismiss,
}: {
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <aside
      aria-labelledby="install-title"
      className="fixed inset-x-0 bottom-16 z-40 px-4 pb-3 md:bottom-4"
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-card border border-border bg-card p-3 shadow-lg">
        <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p id="install-title" className="font-bold leading-tight">
            {messages.install.title}
          </p>
          <p className="text-sm text-muted-foreground">{messages.install.body}</p>
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 font-bold text-primary-foreground"
        >
          {messages.install.install}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={messages.install.dismiss}
          className="grid size-11 shrink-0 place-items-center rounded-full text-lg font-bold text-muted-foreground hover:bg-muted"
        >
          ✕
        </button>
      </div>
    </aside>
  );
}

/**
 * Offers "add to home screen" when the browser allows it, to a player who already predicted, from
 * the second visit, until they close it once.
 */
export function InstallPrompt({
  signedIn,
  hasPredicted,
}: {
  signedIn: boolean;
  hasPredicted: boolean;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Counted once per visit, whether or not the browser ends up allowing the install.
    const offer = shouldOfferInstall({ signedIn, hasPredicted, ...countThisVisit() });
    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (offer) setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [signedIn, hasPredicted]);

  if (!deferred) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Without storage the offer may come back on a later visit: acceptable.
    }
    setDeferred(null);
  };

  return (
    <InstallBanner
      onInstall={() => {
        void deferred.prompt();
        close();
      }}
      onDismiss={close}
    />
  );
}
