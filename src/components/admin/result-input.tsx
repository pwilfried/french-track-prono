"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

export type ResultAthleteOption = { id: string; label: string };

/**
 * One podium step on the admin "saisie résultat" screen.
 * Medal gradient reflects the rank; athlete + mark + tie flag are all controlled.
 * Keep this component dumb: parent holds the full podium state and handles the ex-æquo cascade.
 */
export function ResultInput({
  rank,
  athletes,
  athleteId,
  mark,
  tie,
  placeholder = "Sélectionner une athlète",
  onAthleteChange,
  onMarkChange,
  onTieChange,
  className,
}: {
  rank: 1 | 2 | 3;
  athletes: ResultAthleteOption[];
  athleteId?: string;
  mark?: string;
  tie?: boolean;
  placeholder?: string;
  onAthleteChange?: (id: string) => void;
  onMarkChange?: (mark: string) => void;
  onTieChange?: (tie: boolean) => void;
  className?: string;
}) {
  const selectId = useId();
  const markId = useId();
  const tieId = useId();
  const style = rankStyle[rank];

  return (
    <div
      className={cn(
        "grid grid-cols-[40px_1fr] gap-3 rounded-2xl p-3",
        style.gradient,
        style.text,
        className,
      )}
    >
      <div className="self-center text-center font-display text-[28px] font-extrabold leading-none">
        <span aria-hidden="true">{rank}</span>
        <span className="sr-only">Place {rank}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={selectId} className="sr-only">
          Athlète du rang {rank}
        </label>
        <select
          id={selectId}
          value={athleteId ?? ""}
          onChange={(e) => onAthleteChange?.(e.target.value)}
          className="min-h-9 rounded-md bg-white/90 px-3 py-1.5 text-sm font-semibold text-nuit outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-[1fr_auto] items-center gap-1.5">
          <label htmlFor={markId} className="sr-only">
            Chrono ou marque du rang {rank}
          </label>
          <input
            id={markId}
            type="text"
            inputMode="decimal"
            value={mark ?? ""}
            onChange={(e) => onMarkChange?.(e.target.value)}
            placeholder="—.——"
            className="min-h-9 rounded-md bg-white/90 px-3 py-1.5 font-mono text-sm font-bold tabular-nums text-nuit placeholder:text-[#6B7694] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <label
            htmlFor={tieId}
            className={cn(
              "inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold select-none",
              tie ? "bg-white/70" : "bg-white/50",
            )}
          >
            <input
              id={tieId}
              type="checkbox"
              checked={tie ?? false}
              onChange={(e) => onTieChange?.(e.target.checked)}
              className="size-3.5 accent-current"
            />
            ex æquo
          </label>
        </div>
      </div>
    </div>
  );
}

const rankStyle = {
  1: {
    gradient: "bg-gradient-to-b from-[#f7d672] to-[#d99a22]",
    text: "text-[#3a2a05]",
  },
  2: {
    gradient: "bg-gradient-to-b from-[#e6e8eb] to-[#a9aeb5]",
    text: "text-[#1b1f26]",
  },
  3: {
    gradient: "bg-gradient-to-b from-[#d99464] to-[#8b4513]",
    text: "text-white",
  },
} as const;
