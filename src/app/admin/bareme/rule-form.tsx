"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";

import { saveRuleAction, type RuleState } from "./actions";

/** One value of the scale, edited in place. */
export function RuleForm({ ruleKey, value }: { ruleKey: string; value: number }) {
  const [state, action] = useActionState<RuleState, FormData>(saveRuleAction, {});
  const label = messages.scale.rules[ruleKey] ?? ruleKey;
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="key" value={ruleKey} />
      <span aria-hidden className="text-sm font-semibold">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          name="value"
          aria-label={label}
          defaultValue={String(value)}
          inputMode="decimal"
          className="min-h-11 w-24 shrink-0 rounded-xl border-2 border-border bg-background px-2.5 text-right font-mono text-base"
        />
        <SubmitButton pendingLabel={messages.scale.saving} variant="muted">
          {messages.scale.save}
        </SubmitButton>
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      {state.saved && (
        <p role="status" className="text-sm font-semibold text-success-text">
          {messages.scale.saved}
        </p>
      )}
    </form>
  );
}
