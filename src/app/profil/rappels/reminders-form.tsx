"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/account/submit-button";
import { REMINDER_LEADS, SHOWN_REMINDER_FAMILIES } from "@/domain/reminders";

import { messages } from "../../messages.fr";
import { saveReminderSettingsAction, type ReminderSettingsState } from "./actions";

const text = messages.reminders;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const legend = "text-sm font-bold uppercase tracking-wide text-muted-foreground";
const select =
  "min-h-11 w-full rounded-card border-2 border-border bg-card px-3 font-mono font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring";

/** « Mes rappels »: a switch per family, the lead before a lock, the quiet hours (#681). */
export function RemindersForm({ initial }: { initial: ReminderSettingsState }) {
  const [state, action] = useActionState(saveReminderSettingsAction, initial);
  const { settings } = state;
  // The form is drawn again after a save: its key follows the settings saved.
  const key = JSON.stringify(settings);

  return (
    <form key={key} action={action} noValidate className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className={legend}>{text.families}</legend>
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
          {SHOWN_REMINDER_FAMILIES.map((family) => (
            <li key={family}>
              <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span id={`family-${family}`} className="block font-semibold">
                    {text.family[family].label}
                  </span>
                  <span
                    id={`family-${family}-hint`}
                    className="block text-sm text-muted-foreground"
                  >
                    {text.family[family].hint}
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-labelledby={`family-${family}`}
                  aria-describedby={`family-${family}-hint`}
                  name="family"
                  value={family}
                  defaultChecked={settings.families[family]}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-border bg-muted transition-colors after:absolute after:left-0.5 after:size-5 after:rounded-full after:bg-card after:shadow after:transition-transform peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-ring motion-reduce:transition-none motion-reduce:after:transition-none"
                />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={legend}>{text.lead}</legend>
        <div className="flex flex-wrap gap-2">
          {REMINDER_LEADS.map((minutes) => (
            <label key={minutes} className="cursor-pointer">
              <input
                type="radio"
                name="lead"
                value={minutes}
                defaultChecked={settings.leadMinutes === minutes}
                className="peer sr-only"
              />
              <span className="inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-4 text-sm font-semibold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-ring">
                {text.leadOption(minutes)}
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{text.leadHint}</p>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={legend}>{text.quiet}</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["quietFrom", "quietTo"] as const).map((name) => (
            <label key={name} className="flex flex-col gap-1 text-sm font-semibold">
              {text[name]}
              <select name={name} defaultValue={settings[name]} className={select}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {text.hour(h)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{text.quietHint}</p>
      </fieldset>

      {state.error ? (
        <p role="alert" className="rounded-card bg-muted p-4 font-semibold">
          {messages.errors[state.error]}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="rounded-card bg-muted p-4 font-semibold">
          {text.saved}
        </p>
      ) : null}
      <SubmitButton pendingLabel={text.saving}>{text.save}</SubmitButton>
    </form>
  );
}
