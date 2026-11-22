"use client";

import { useState, useTransition } from "react";

import { messages } from "@/app/messages.fr";
import type { ErrorCode } from "@/application/errors";
import type { LeagueKind, PredictionLeague } from "@/application/prediction-leagues";
import { buttonVariants } from "@/components/ui/button";
import { ChipStatus } from "@/components/ui/chip-status";
import { cn } from "@/lib/utils";

import { BottomSheet } from "../ui/bottom-sheet";

const text = messages.predictionLeagues;

/** Sets the leagues the prediction counts in; the error code when it is refused. */
export type SavePredictionLeagues = (leagueIds: string[]) => Promise<{ error?: ErrorCode }>;

/** The id of the block on the page of the event: « Voir mon prono » leads there. */
const PREDICTION_LEAGUES_ID = "ce-prono-compte";

const kindLabel: Record<LeagueKind, string> = {
  private: messages.leagues.privateBadge,
  public: messages.leagues.publicBadge,
  official: messages.leagues.officialBadge,
};

function KindChip({ kind }: { kind: LeagueKind }) {
  return (
    <ChipStatus tone={kind === "official" ? "brand" : "neutral"}>{kindLabel[kind]}</ChipStatus>
  );
}

/** « Classement général · Toujours »: the podium always counts there, without a choice. */
function GeneralLine() {
  return (
    <li className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-2">
      <span className="min-w-0 font-bold break-words">{text.general}</span>
      <ChipStatus tone="gold">{text.always}</ChipStatus>
    </li>
  );
}

function LeagueText({ league }: { league: PredictionLeague }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-bold break-words">{league.name}</span>
      <span className="block text-sm text-muted-foreground">
        {text.standing(league.memberCount, league.rank)}
      </span>
    </span>
  );
}

/**
 * « Ajouter ce prono à mes ligues » (#1068): after a save, the player's leagues counting the
 * competition, none checked. « Plus tard » closes it: the podium counts in the general ranking
 * whatever the choice.
 */
export function PredictionLeaguesSheet({
  open,
  onClose,
  leagues,
  lockLabel,
  save,
}: {
  open: boolean;
  onClose: () => void;
  leagues: PredictionLeague[];
  /** « samedi 23 novembre à 19:00 », Paris time. */
  lockLabel: string;
  save: SavePredictionLeagues;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [done, setDone] = useState<string[] | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const toggle = (id: string) =>
    setChecked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const counted = leagues.filter((l) => l.counted).map((l) => l.id);
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await save([...new Set([...counted, ...checked])]);
      if (result.error) setError(result.error);
      else setDone(leagues.filter((l) => checked.includes(l.id)).map((l) => l.name));
    });
  const seeMine = () => {
    onClose();
    requestAnimationFrame(() =>
      document.getElementById(PREDICTION_LEAGUES_ID)?.scrollIntoView({ block: "start" }),
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={text.sheetTitle}>
      {done ? (
        <div className="flex flex-col gap-3">
          <p
            role="status"
            className="rounded-2xl bg-success-soft px-3.5 py-3 font-semibold text-success-ink"
          >
            {text.done(done)}
          </p>
          <button type="button" onClick={seeMine} className={cn(buttonVariants(), "w-full")}>
            {text.seeMine}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed">{text.sheetText}</p>
          <ul className="flex flex-col gap-2">
            <GeneralLine />
            {leagues.map((league) => {
              const on = checked.includes(league.id);
              return (
                <li key={league.id}>
                  <label
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-3.5 py-2",
                      on ? "border-accent-text bg-primary-soft" : "border-border bg-card",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(league.id)}
                      className="size-6 shrink-0 accent-primary"
                    />
                    <LeagueText league={league} />
                    <KindChip kind={league.kind} />
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted-foreground">{text.sheetNote(lockLabel)}</p>
          {error && (
            <p role="alert" className="text-sm font-semibold text-accent-text">
              {messages.errors[error]}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={checked.length === 0 || pending}
            className={cn(buttonVariants(), "w-full")}
          >
            {pending ? text.adding : checked.length === 0 ? text.pickOne : text.add(checked.length)}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          >
            {text.later}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

/**
 * « Ce prono compte dans » (#1068), under the player's podium: one switch per league until the
 * lock, then « Compte » or « Ne compte pas ». The general ranking always counts it.
 */
export function PredictionLeaguesBlock({
  leagues,
  locked,
  lockLabel,
  save,
}: {
  leagues: PredictionLeague[];
  locked: boolean;
  lockLabel: string;
  save?: SavePredictionLeagues;
}) {
  const [counted, setCounted] = useState(() => leagues.filter((l) => l.counted).map((l) => l.id));
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  // A save elsewhere (the sheet) brings new leagues from the server: follow them.
  const fromServer = leagues
    .filter((l) => l.counted)
    .map((l) => l.id)
    .join(",");
  const [seen, setSeen] = useState(fromServer);
  if (seen !== fromServer) {
    setSeen(fromServer);
    setCounted(fromServer ? fromServer.split(",") : []);
  }
  const toggle = (id: string, on: boolean) => {
    if (!save) return;
    const before = counted;
    const next = on ? [...before, id] : before.filter((x) => x !== id);
    setCounted(next);
    startTransition(async () => {
      setError(null);
      const result = await save(next);
      if (result.error) {
        setCounted(before);
        setError(result.error);
      }
    });
  };

  return (
    <section
      id={PREDICTION_LEAGUES_ID}
      aria-labelledby="prediction-leagues-title"
      aria-busy={pending || undefined}
      className="mx-4 flex scroll-mt-4 flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <div>
        <h2 id="prediction-leagues-title" className="font-display text-xl font-extrabold">
          {text.blockTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {locked ? text.lockedText(counted.length) : text.blockText}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        <GeneralLine />
        {leagues.map((league) => {
          const on = counted.includes(league.id);
          return (
            <li key={league.id}>
              {locked ? (
                <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2">
                  <LeagueText league={league} />
                  <ChipStatus tone={on ? "ok" : "ghost"}>
                    {on ? text.counts : text.notCounted}
                  </ChipStatus>
                </div>
              ) : (
                <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2">
                  <LeagueText league={league} />
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={text.switchLabel(league.name)}
                    checked={on}
                    disabled={pending}
                    onChange={(e) => toggle(league.id, e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className="relative h-7 w-12 shrink-0 rounded-full bg-border transition-colors peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-ring peer-disabled:opacity-50 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 motion-reduce:transition-none motion-reduce:after:transition-none"
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {pending && (
        <p role="status" className="text-sm text-muted-foreground">
          {text.saving}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[error]}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {locked ? (
          <>
            <span aria-hidden>🔒 </span>
            {text.lockedFoot}
          </>
        ) : (
          text.openFoot(lockLabel)
        )}
      </p>
    </section>
  );
}
