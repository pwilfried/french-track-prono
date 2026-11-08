"use client";

import Link from "next/link";
import { useActionState } from "react";

import { SubmitButton } from "@/components/account/submit-button";
import { buttonVariants } from "@/components/ui/button";

import { messages } from "../../messages.fr";
import { deleteAccountAction, type DeleteAccountState } from "./actions";

export function DeleteForm() {
  const [state, action] = useActionState<DeleteAccountState, FormData>(deleteAccountAction, {});
  const text = state.error ? messages.errors[state.error] : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <p className="rounded-card bg-muted p-4">{messages.deleteAccount.whatGoes}</p>
      <label className="flex min-h-12 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="confirm"
          aria-invalid={text ? true : undefined}
          aria-describedby={text ? "confirm-error" : undefined}
          className="size-7 shrink-0 accent-primary"
        />
        <span className="font-bold">{messages.deleteAccount.confirmLabel}</span>
      </label>
      {text ? (
        <p id="confirm-error" role="alert" className="text-sm font-semibold text-accent-text">
          {text}
        </p>
      ) : null}
      <SubmitButton pendingLabel={messages.deleteAccount.submitting}>
        {messages.deleteAccount.submit}
      </SubmitButton>
      <Link href="/profil" className={`${buttonVariants({ variant: "muted" })} w-full`}>
        {messages.deleteAccount.cancel}
      </Link>
    </form>
  );
}
