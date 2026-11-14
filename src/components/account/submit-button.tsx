"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Submit button of every player form (#712): disabled and saying so while the form is sent, so a
 * double tap sends once. `intent` tells the form's action which button was pressed.
 */
export function SubmitButton({
  children,
  pendingLabel,
  intent,
  variant = "default",
  noValidate,
  disabled = false,
  className = "w-full",
  ariaLabel,
  navigates = false,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  intent?: string;
  variant?: "default" | "muted" | "outline";
  noValidate?: boolean;
  /** Not sendable yet (a required choice is missing). */
  disabled?: boolean;
  /** Full width by default; these classes win over the button's own. */
  className?: string;
  /** A name that says more than the visible text (one button per row of a list). */
  ariaLabel?: string;
  /**
   * The form goes to a URL (`action="/…"`), not to a server action: the browser loads the next
   * page, and the button stays pending until it does (back from the history, it is free again).
   */
  navigates?: boolean;
}) {
  const { pending, data } = useFormStatus();
  const button = useRef<HTMLButtonElement>(null);
  // Set as soon as the form is sent, before React shows it: a second tap in between is ignored.
  const sending = useRef(false);
  const pendingNow = useRef(pending);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    const form = button.current?.form;
    if (!form) return;
    // Listened on the window, after React's own handlers (bound on the document): a form whose
    // `onSubmit` cancels the sending (a check before sending) is already marked so here.
    const onSubmit = (event: SubmitEvent) => {
      if (event.target !== form || event.defaultPrevented) return;
      sending.current = true;
      if (navigates) setSent(true);
      // A form whose sending was cancelled by the page never turns pending: free it again.
      else setTimeout(() => (sending.current = pendingNow.current), 1000);
    };
    const onShow = () => {
      sending.current = false;
      setSent(false);
    };
    window.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onShow);
    };
  }, [navigates]);
  useEffect(() => {
    pendingNow.current = pending;
    if (!pending && !navigates) sending.current = false;
  }, [pending, navigates]);
  const busy = pending || sent;
  // Only the pressed button shows the waiting label; the others are just disabled.
  const mine = sent || (pending && (intent === undefined || data?.get("intent") === intent));
  return (
    <button
      ref={button}
      type="submit"
      name={intent ? "intent" : undefined}
      value={intent}
      formNoValidate={noValidate}
      onClick={(event) => {
        if (sending.current) event.preventDefault();
      }}
      disabled={busy || disabled}
      aria-label={mine ? undefined : ariaLabel}
      className={cn(buttonVariants({ variant }), className)}
    >
      {mine ? pendingLabel : children}
    </button>
  );
}
