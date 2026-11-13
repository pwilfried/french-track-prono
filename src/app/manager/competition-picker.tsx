"use client";

import { useState } from "react";

import { messages } from "@/app/messages.fr";
import type { SeasonCompetition } from "@/application/manager-leagues";
import { MIN_SEASON_COMPETITIONS, seasonFormat } from "@/domain/manager-league";

const text = messages.manager;

/**
 * The competitions of a season (#644), ticked among those not finished, with the count of players
 * and matchdays worked out as they are ticked: « 8 compétitions → 4 joueurs · 6 journées
 * aller-retour + 2 bonus ».
 */
export function CompetitionPicker({
  competitions,
  chosen,
  label,
  hint,
}: {
  competitions: SeasonCompetition[];
  chosen: readonly string[];
  label: string;
  hint: string;
}) {
  const [ids, setIds] = useState(() => new Set(chosen));
  const format = seasonFormat(ids.size);
  const toggle = (id: string, on: boolean) =>
    setIds((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </legend>
      <p className="text-sm text-muted-foreground">{hint}</p>
      {competitions.length < MIN_SEASON_COMPETITIONS && (
        <p className="rounded-2xl bg-muted px-3.5 py-3 text-sm">{text.competitionsNone}</p>
      )}
      <ul className="flex flex-col gap-1.5">
        {competitions.map((c) => (
          <li key={c.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-2 has-checked:border-primary">
              <input
                type="checkbox"
                name="competitions"
                value={c.id}
                checked={ids.has(c.id)}
                onChange={(event) => toggle(c.id, event.target.checked)}
                className="size-5 shrink-0 accent-primary"
              />
              <span className="min-w-0 break-words">
                {text.competitionOption(c.name, text.day(c.firstEventAt))}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p
        role="status"
        className={`rounded-2xl px-3.5 py-3 text-sm font-semibold ${format ? "bg-success/15 text-success-text" : "bg-muted text-foreground"}`}
      >
        {format
          ? text.seasonFormat(ids.size, format.players, format.duelDays, format.bonusDays)
          : text.seasonTooFew(ids.size)}
      </p>
    </fieldset>
  );
}
