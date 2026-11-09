"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { DISCIPLINE_FAMILIES, MARK_UNITS } from "@/domain/discipline";

import { createDisciplineAction, type CreateDisciplineState } from "./actions";

const text = messages.disciplines;
const field =
  "min-h-11 rounded-xl border-2 border-border bg-background px-2.5 text-base focus-visible:border-primary focus-visible:outline-none";

/** « Nouvelle discipline »: name, family, unit, which way is better, tolerance (#292). */
export function CreateDisciplineForm() {
  const [state, action] = useActionState<CreateDisciplineState, FormData>(
    createDisciplineAction,
    {},
  );
  return (
    <details
      className="rounded-card border-2 border-dashed border-border p-3.5"
      open={!!state.error}
    >
      <summary className="flex min-h-11 cursor-pointer items-center font-bold text-brand dark:text-secondary">
        {text.newDiscipline}
      </summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold">
          {text.nameLabel}
          <input name="name" required maxLength={40} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          {text.familyLabel}
          <select name="family" defaultValue="sprint" className={field}>
            {DISCIPLINE_FAMILIES.map((family) => (
              <option key={family} value={family}>
                {text.family[family]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          {text.unitLabel}
          <select name="unit" defaultValue="time" className={field}>
            {MARK_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {text.unitName[unit]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          {text.directionLabel}
          <select name="direction" defaultValue="lower" className={field}>
            <option value="lower">{text.direction.lower}</option>
            <option value="higher">{text.direction.higher}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          {text.toleranceLabel}
          <input name="tolerance" inputMode="decimal" defaultValue="0.05" className={field} />
        </label>
        <SubmitButton pendingLabel={text.creating}>{text.create}</SubmitButton>
        {state.error ? (
          <p role="alert" className="text-sm font-semibold text-accent-text">
            {messages.errors[state.error]}
          </p>
        ) : state.created ? (
          <p role="status" className="text-sm font-semibold text-success-text">
            {text.created(state.created)}
          </p>
        ) : null}
      </form>
    </details>
  );
}
