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
}: {
  children: React.ReactNode;
  pendingLabel: string;
  intent?: string;
  variant?: "default" | "secondary";
  noValidate?: boolean;
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
      disabled={pending}
      className={`${buttonVariants({ variant })} w-full`}
    >
      {mine ? pendingLabel : children}
    </button>
  );
}
