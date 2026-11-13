"use client";

import { useActionState, useState } from "react";

import { messages } from "@/app/messages.fr";
import type { SeasonCompetition } from "@/application/manager-leagues";
import { SubmitButton } from "@/components/account/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { parisToUtc } from "@/domain/competition";
import {
  plannedMercatoEnd,
  ROUND_HOUR_CHOICES,
  seasonStart,
  type RoundMode,
} from "@/domain/manager-league";

import { CompetitionPicker } from "./competition-picker";
import {
  launchMercatoAction,
  setCompetitionsAction,
  setMercatoAction,
  type MercatoFormState,
} from "./mercato-actions";

const text = messages.manager;

const chip =
  "inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-4 text-sm font-semibold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-ring";
const legend = "text-sm font-bold uppercase tracking-wide text-muted-foreground";
const select = "min-h-11 w-full rounded-xl border-2 border-border bg-card px-2.5 text-base";

function FormOutcome({ state, saved }: { state: MercatoFormState; saved: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-semibold text-accent-text">
        {messages.errors[state.error]}
      </p>
    );
  }
  return state.saved ? (
    <p role="status" className="text-sm font-semibold text-success-text">
      {saved}
    </p>
  ) : null;
}

/**
 * The competitions of the league, changed by its creator until the mercato (#644): the number of
 * players follows, never under the players already in.
 */
export function CompetitionsForm({
  leagueId,
  competitions,
  chosen,
}: {
  leagueId: string;
  /** The league's competitions and those still available, first one first. */
  competitions: SeasonCompetition[];
  chosen: string[];
}) {
  const [state, action] = useActionState<MercatoFormState, FormData>(setCompetitionsAction, {});
  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-4"
    >
      <input type="hidden" name="league" value={leagueId} />
      <CompetitionPicker
        competitions={competitions}
        chosen={chosen}
        label={text.competitionsEditLabel}
        hint={text.competitionsEditHint}
      />
      <SubmitButton pendingLabel={text.savingMercato} variant="muted">
        {text.saveCompetitions}
      </SubmitButton>
      <FormOutcome state={state} saved={text.competitionsSaved} />
    </form>
  );
}

/**
 * The mercato settings of the creator (#619): start in Paris time, round durations. With custom
 * rounds, warns when the mercato would end less than 1 hour before the first competition (#644).
 */
export function MercatoSettingsForm({
  leagueId,
  startsAt,
  rounds,
  autoHours,
  competitions,
}: {
  leagueId: string;
  /** Paris time, "YYYY-MM-DDTHH:mm", or "". */
  startsAt: string;
  rounds: RoundMode;
  /** The first round of French Track rules, in hours. */
  autoHours: number;
  /** The competitions of the league, first one first. */
  competitions: SeasonCompetition[];
}) {
  const [state, action] = useActionState<MercatoFormState, FormData>(setMercatoAction, {});
  const [mode, setMode] = useState(rounds.mode);
  const [start, setStart] = useState(startsAt);
  const [now] = useState(() => new Date().toISOString());
  const [custom, setCustom] = useState(
    rounds.mode === "custom" ? rounds : { firstHours: 24, nextHours: 24 },
  );
  const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) ? start : null;
  const season =
    mode === "custom"
      ? seasonStart(
          competitions,
          plannedMercatoEnd(local ? parisToUtc(local) : now, { ...custom, longRounds: 1 }),
        )
      : null;
  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-4"
    >
      <input type="hidden" name="league" value={leagueId} />
      <label className="flex flex-col gap-1.5">
        <span className={legend}>{text.startsAtLabel}</span>
        <input
          type="datetime-local"
          name="startsAt"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          className={select}
        />
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
                ["firstHours", text.firstRoundLabel],
                ["nextHours", text.nextRoundsLabel],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="flex flex-col gap-1.5 text-sm font-semibold">
                {label}
                <select
                  name={name}
                  value={custom[name]}
                  onChange={(event) =>
                    setCustom((current) => ({ ...current, [name]: Number(event.target.value) }))
                  }
                  className={select}
                >
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
        {season?.missed && (
          <p
            role="alert"
            className="rounded-2xl bg-muted px-3.5 py-3 text-sm font-semibold text-accent-text"
          >
            {text.seasonMissed(
              season.missed.name,
              text.day(season.missed.firstEventAt),
              season.first?.name ?? null,
            )}
          </p>
        )}
      </fieldset>

      <SubmitButton pendingLabel={text.savingMercato} variant="muted">
        {text.saveMercato}
      </SubmitButton>
      <FormOutcome state={state} saved={text.mercatoSaved} />
    </form>
  );
}

/**
 * « Lancer le mercato maintenant », active only once every player awaited is in and enough
 * competitions start after the planned end of the mercato (`short` when not, #644).
 */
export function LaunchMercatoForm({
  leagueId,
  awaited,
  short,
}: {
  leagueId: string;
  awaited: number;
  short: boolean;
}) {
  const [state, action] = useActionState<MercatoFormState, FormData>(launchMercatoAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="league" value={leagueId} />
      {awaited > 0 || short ? (
        <button type="button" disabled className={`${buttonVariants()} w-full`}>
          {awaited > 0 ? text.launchWaiting(awaited) : text.launch}
        </button>
      ) : (
        <SubmitButton pendingLabel={text.launching}>{text.launch}</SubmitButton>
      )}
      {short && awaited === 0 && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {text.seasonShort}
        </p>
      )}
      <FormOutcome state={state} saved="" />
    </form>
  );
}
