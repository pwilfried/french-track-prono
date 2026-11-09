"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

import { messages } from "@/app/messages.fr";
import { type InstallWay, installWay, shouldOfferInstall } from "@/domain/install-prompt";

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

const noSubscription = () => () => {};
const thisDevice = () =>
  installWay({
    userAgent: navigator.userAgent,
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  });

/** How this device installs the app: null on the server, and once the app is installed. */
function useInstallWay(): InstallWay | null {
  return useSyncExternalStore(noSubscription, thisDevice, () => null);
}

/** The browser's own prompt, kept for our button once the browser allows the install. */
function useBrowserPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return [deferred, setDeferred] as const;
}

/** The iPhone share icon, so the player recognises the button to touch. */
function ShareGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="mr-0.5 inline size-4 -translate-y-px align-middle"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12M8 7l4-4 4 4M8 11H5v10h14V11h-3" />
    </svg>
  );
}

/** What to do on this device: the browser's button needs nothing, the other two need steps. */
function Steps({ way }: { way: Exclude<InstallWay, "browser"> }) {
  const text = messages.install;
  if (way === "in-app") return <>{text.inApp}</>;
  return (
    <>
      {text.ios.before} <ShareGlyph />
      {text.ios.share}
      {text.ios.after}
    </>
  );
}

/** The discreet banner itself, at the bottom of the screen above the navigation bar. */
export function InstallBanner({
  way,
  onInstall,
  onDismiss,
}: {
  way: InstallWay;
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
          <p className="text-sm text-muted-foreground">
            {way === "browser" ? messages.install.body : <Steps way={way} />}
          </p>
        </div>
        {way === "browser" && (
          <button
            type="button"
            onClick={onInstall}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 font-bold text-primary-foreground"
          >
            {messages.install.install}
          </button>
        )}
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
 * Offers "add to home screen" to a player who already predicted, until they close it once: the
 * browser's prompt from the second visit, the iPhone and in-app steps from the first.
 */
export function InstallPrompt({
  signedIn,
  hasPredicted,
}: {
  signedIn: boolean;
  hasPredicted: boolean;
}) {
  const way = useInstallWay();
  // Counted once per visit, whatever the device; the session flag makes it safe to run twice.
  const [visit] = useState(countThisVisit);
  const [deferred] = useBrowserPrompt();
  const [closed, setClosed] = useState(false);

  if (!way || closed || !shouldOfferInstall({ signedIn, hasPredicted, ...visit, way })) return null;
  if (way === "browser" && !deferred) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Without storage the offer may come back on a later visit: acceptable.
    }
    setClosed(true);
  };

  return (
    <InstallBanner
      way={way}
      onInstall={() => {
        void deferred?.prompt();
        close();
      }}
      onDismiss={close}
    />
  );
}

const CARD = "rounded-card border border-border bg-card";
const ROW = "flex min-h-11 w-full items-center justify-between px-4 text-left font-semibold";

/** A permanent "install the app" row for the profile, hidden once the app is installed. */
export function InstallEntry() {
  const way = useInstallWay();
  const [deferred, setDeferred] = useBrowserPrompt();

  if (!way) return null;
  if (way === "browser") {
    if (!deferred) return null;
    return (
      <button
        type="button"
        className={`${CARD} ${ROW}`}
        onClick={() => {
          void deferred.prompt();
          // The browser's prompt can only be shown once.
          setDeferred(null);
        }}
      >
        {messages.install.profile}
        <span aria-hidden="true">›</span>
      </button>
    );
  }
  return (
    <details className={`group ${CARD}`}>
      <summary className={`${ROW} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        {messages.install.profile}
        <span
          aria-hidden="true"
          className="transition-transform group-open:rotate-90 motion-reduce:transition-none"
        >
          ›
        </span>
      </summary>
      <p className="px-4 pb-3 text-sm text-muted-foreground">
        <Steps way={way} />
      </p>
    </details>
  );
}
