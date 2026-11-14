"use client";

import { useFormStatus } from "react-dom";

import { buttonVariants } from "@/components/ui/button";

/** Submit button: `intent` tells the form's action which button was pressed. */
export function SubmitButton({
  children,
  pendingLabel,
  intent,
  variant = "default",
  noValidate,
  disabled = false,
  className = "w-full",
  ariaLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  intent?: string;
  variant?: "default" | "muted" | "outline";
  noValidate?: boolean;
  /** Not sendable yet (a required choice is missing). */
  disabled?: boolean;
  /** Full width by default. */
  className?: string;
  /** A name that says more than the visible text (one button per row of a list). */
  ariaLabel?: string;
}) {
  const { pending, data } = useFormStatus();
  // Only the pressed button shows the waiting label; the others are just disabled.
  const mine = pending && (intent === undefined || data?.get("intent") === intent);
  return (
    <button
      type="submit"
      name={intent ? "intent" : undefined}
      value={intent}
      formNoValidate={noValidate}
      disabled={pending || disabled}
      aria-label={mine ? undefined : ariaLabel}
      className={`${buttonVariants({ variant })} ${className}`}
    >
      {mine ? pendingLabel : children}
    </button>
  );
}
