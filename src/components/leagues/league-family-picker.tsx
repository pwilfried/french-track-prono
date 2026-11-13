"use client";

import { useEffect, useState } from "react";

import { messages } from "@/app/messages.fr";
import { LEAGUE_FAMILIES, type LeagueFamily } from "@/domain/league-families";

const text = messages.leagues;

/**
 * « Épreuves qui comptent » at league creation (#613): « Toutes les épreuves » by default, or some
 * families (eight chips, several at once), sent as `family` fields. `onReadyChange` tells whether
 * the league can be created: not while « Certaines familles » has no chip ticked.
 */
export function LeagueFamilyPicker({
  defaultFamilies = [],
  onReadyChange,
}: {
  /** Families ticked from the start (a form sent back with an error); some: « Certaines familles ». */
  defaultFamilies?: LeagueFamily[];
  onReadyChange?: (ready: boolean) => void;
}) {
  const [some, setSome] = useState(defaultFamilies.length > 0);
  const [chosen, setChosen] = useState<LeagueFamily[]>(defaultFamilies);
  const ready = !some || chosen.length > 0;
  useEffect(() => onReadyChange?.(ready), [ready, onReadyChange]);
  const toggle = (family: LeagueFamily) =>
    setChosen((current) =>
      current.includes(family) ? current.filter((f) => f !== family) : [...current, family],
    );
  const names = LEAGUE_FAMILIES.filter((f) => chosen.includes(f)).map((f) => text.family[f]);

  const option = (value: boolean, label: string, hint: string) => (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-3 has-checked:border-primary">
      <input
        type="radio"
        name="families-mode"
        value={value ? "some" : "all"}
        checked={some === value}
        onChange={() => setSome(value)}
        className="mt-0.5 size-5 shrink-0 accent-primary"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-bold">{label}</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </span>
    </label>
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {text.familiesTitle}
      </legend>
      {option(false, text.allEvents, text.allEventsHint)}
      {option(true, text.someFamilies, text.someFamiliesHint)}
      {some && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            {LEAGUE_FAMILIES.map((family) => (
              <label
                key={family}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-border bg-card px-3.5 text-sm font-semibold has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
              >
                <input
                  type="checkbox"
                  name="family"
                  value={family}
                  checked={chosen.includes(family)}
                  onChange={() => toggle(family)}
                  className="sr-only"
                />
                {text.family[family]}
              </label>
            ))}
          </div>
          <p
            aria-live="polite"
            className={ready ? "text-sm font-semibold" : "text-sm font-semibold text-accent-text"}
          >
            {ready ? text.familiesSummary(names) : text.familiesNone}
          </p>
          <p className="text-sm text-muted-foreground">{text.familiesNote}</p>
        </div>
      )}
    </fieldset>
  );
}
