"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";

import { returnToMyAccountAction } from "./demo-login-actions";
import { demoPseudoFrom } from "./demo-login";
import { messages } from "./messages.fr";

const text = messages.demoLogin;

/**
 * Pre-production (#637): while an admin plays as a demo player, a band on every page says who and
 * offers to come back. Read from a cookie in the browser, so the pages stay static.
 */
export function DemoBanner() {
  // Re-rendered on each navigation, so the cookie is read again: the sign-in and the way back
  // both end with one.
  usePathname();
  const pseudo = useSyncExternalStore(
    noSubscription,
    () => demoPseudoFrom(document.cookie),
    () => null,
  );
  if (!pseudo) return null;
  return (
    <section
      aria-label={text.bannerLabel}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-secondary px-4 py-1 text-secondary-foreground"
    >
      <p className="min-w-0 break-words text-sm font-bold">{text.banner(pseudo)}</p>
      <form action={returnToMyAccountAction}>
        <BackButton />
      </form>
    </section>
  );
}

const noSubscription = () => () => {};

/** Disabled and saying so while the admin's session comes back. */
function BackButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center rounded-full border-2 border-secondary-foreground px-4 text-sm font-bold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-foreground disabled:opacity-60"
    >
      {pending ? text.goingBack : text.backToMe}
    </button>
  );
}
