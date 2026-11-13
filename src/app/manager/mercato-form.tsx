"use client";

import { useActionState, useState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { ROUND_HOUR_CHOICES, type RoundMode } from "@/domain/manager-league";

import { launchMercatoAction, setMercatoAction, type MercatoFormState } from "./mercato-actions";

const text = messages.manager;

const chip =
  "inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-4 text-sm font-semibold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-ring";
const legend = "text-sm font-bold uppercase tracking-wide text-muted-foreground";
const select = "min-h-11 w-full rounded-xl border-2 border-border bg-card px-2.5 text-base";

/** The mercato settings of the creator (#619): players, start in Paris time, round durations. */
export function MercatoSettingsForm({
  leagueId,
  targets,
  target,
  startsAt,
  rounds,
  autoHours,
}: {
  leagueId: string;
  /** The targets the creator may pick: even, 4 to 10, not under the players in. */
  targets: number[];
  target: number;
  /** Paris time, "YYYY-MM-DDTHH:mm", or "". */
  startsAt: string;
  rounds: RoundMode;
  /** The first round of French Track rules, in hours. */
  autoHours: number;
}) {
  const [state, action] = useActionState<MercatoFormState, FormData>(setMercatoAction, {});
  const [mode, setMode] = useState(rounds.mode);
  const custom = rounds.mode === "custom" ? rounds : { firstHours: 24, nextHours: 24 };
  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-4"
    >
      <input type="hidden" name="league" value={leagueId} />
      <fieldset className="flex flex-col gap-2">
        <legend className={legend}>{text.targetLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {targets.map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name="target"
                value={n}
                defaultChecked={n === target}
                className="peer sr-only"
              />
              <span className={chip}>{text.targetOption(n)}</span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{text.targetHint}</p>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className={legend}>{text.startsAtLabel}</span>
        <input type="datetime-local" name="startsAt" defaultValue={startsAt} className={select} />
        <span className="text-sm text-muted-foreground">{text.startsAtHint}</span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className={legend}>{text.roundsLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {(["auto", "custom"] as const).map((m) => (
            <label key={m} className="cursor-pointer">
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="peer sr-only"
              />
              <span className={chip}>
                {m === "auto" ? text.roundsAuto(autoHours) : text.roundsCustom}
              </span>
            </label>
          ))}
        </div>
        {mode === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["firstHours", text.firstRoundLabel, custom.firstHours],
                ["nextHours", text.nextRoundsLabel, custom.nextHours],
              ] as const
            ).map(([name, label, value]) => (
              <label key={name} className="flex flex-col gap-1.5 text-sm font-semibold">
                {label}
                <select name={name} defaultValue={value} className={select}>
                  {ROUND_HOUR_CHOICES.map((h) => (
                    <option key={h} value={h}>
                      {text.hours(h)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <SubmitButton pendingLabel={text.savingMercato} variant="muted">
        {text.saveMercato}
      </SubmitButton>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      ) : state.saved ? (
        <p role="status" className="text-sm font-semibold text-success-text">
          {text.mercatoSaved}
        </p>
      ) : null}
    </form>
  );
}

/** « Lancer le mercato maintenant », active only once every player awaited is in. */
export function LaunchMercatoForm({ leagueId, awaited }: { leagueId: string; awaited: number }) {
  const [state, action] = useActionState<MercatoFormState, FormData>(launchMercatoAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="league" value={leagueId} />
      {awaited > 0 ? (
        <button type="button" disabled className={`${buttonVariants()} w-full`}>
          {text.launchWaiting(awaited)}
        </button>
      ) : (
        <SubmitButton pendingLabel={text.launching}>{text.launch}</SubmitButton>
      )}
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
    </form>
  );
}
