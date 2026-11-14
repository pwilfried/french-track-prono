"use client";

import { Fragment, useState } from "react";

import { messages } from "@/app/messages.fr";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { buttonVariants } from "@/components/ui/button";
import type { DisciplineFamily } from "@/domain/discipline";
import {
  fitsPlace,
  seatAthlete,
  type LineupPlace,
  type LineupStatus,
} from "@/domain/manager-lineup";
import type { ManagerSex } from "@/domain/manager-rules";
import { cn } from "@/lib/utils";

import { AthleteCard } from "./athlete-card";
import { EmptySpot, PlacedSpot, StadiumMap } from "./stadium";

const text = messages.lineup;

export type BoardAthlete = {
  athleteId: string;
  name: string;
  discipline: string;
  family: DisciplineFamily;
  sex: ManagerSex;
  paid: number;
  entered: boolean;
};

const SPOT_BUTTON =
  "block rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring";

/**
 * The lineup of a Manager team before a competition (#427), on the stadium seen from above (#775):
 * one spot per place, each of a family or free (the rules of the league), at its place on the
 * track or the field. Tap a spot: a sheet lists the athletes of the team, the ones who cannot go
 * there greyed with the reason (not entered, another family); pick one and the stadium changes at
 * once (an athlete already placed elsewhere swaps with whoever sat there when they fit). The
 * athletes not lined up wait on the bench below. « Valider mon alignement » turns on once every
 * place the team can fill is filled. Validated: a banner, still editable until the lock. Locked:
 * read only.
 */
export function LineupBoard({
  places,
  fillable,
  athletes,
  initial,
  status,
  error,
  onValidate,
}: {
  places: LineupPlace[];
  fillable: boolean[];
  athletes: BoardAthlete[];
  initial: (string | null)[];
  status: LineupStatus;
  error?: string;
  /** Saves the lineup; true once it is validated. */
  onValidate?: (athleteIds: string[]) => Promise<boolean>;
}) {
  const [placed, setPlaced] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const editable = status !== "locked" && onValidate !== undefined;
  const byId = new Map(athletes.map((a) => [a.athleteId, a]));

  const update = (next: (string | null)[]) => {
    if (next !== placed) {
      setPlaced(next);
      setChanged(true);
    }
    setOpen(null);
  };

  const filled = placed.filter((id) => id !== null).length;
  const missing = new Map<string, number>();
  places.forEach((place, i) => {
    if (fillable[i] && placed[i] === null) {
      const label = text.place[place];
      missing.set(label, (missing.get(label) ?? 0) + 1);
    }
  });
  const bench = athletes
    .filter((a) => !placed.includes(a.athleteId))
    .sort((a, b) => Number(b.entered) - Number(a.entered));
  const lineup = placed.filter((id): id is string => id !== null);

  const spots = places.map((place, i) => {
    const athlete = placed[i] ? byId.get(placed[i]!) : undefined;
    const label = text.place[place];
    const visual = athlete ? (
      <PlacedSpot
        athlete={athlete}
        label={
          editable
            ? undefined
            : messages.team.cardLabel(athlete.name, athlete.discipline, athlete.paid)
        }
      />
    ) : (
      <EmptySpot label={label} fillable={fillable[i] === true} />
    );
    if (!editable) {
      return (
        <Fragment key={i}>
          {visual}
          <span className="sr-only">
            {athlete
              ? text.lockedPlace(label, athlete.name)
              : fillable[i]
                ? text.emptyPlace(label)
                : text.unfillablePlace(label)}
          </span>
        </Fragment>
      );
    }
    return (
      <button
        key={i}
        type="button"
        aria-label={
          athlete
            ? text.takenPlace(label, athlete.name)
            : fillable[i]
              ? text.emptyPlace(label)
              : text.unfillablePlace(label)
        }
        aria-haspopup="dialog"
        onClick={() => setOpen(i)}
        className={SPOT_BUTTON}
      >
        {visual}
      </button>
    );
  });

  const sheetPlace = open === null ? undefined : places[open];
  const sheetLabel = sheetPlace ? text.place[sheetPlace] : "";
  const choices =
    open === null || sheetPlace === undefined
      ? []
      : athletes
          .map((a) => {
            const reason = !a.entered
              ? text.notEntered
              : !fitsPlace(sheetPlace, a.family)
                ? text.wrongFamily(sheetLabel)
                : null;
            const at = placed.indexOf(a.athleteId);
            return { athlete: a, reason, at };
          })
          .sort((a, b) => Number(a.reason !== null) - Number(b.reason !== null));

  return (
    <div className="flex flex-col gap-4">
      {status === "locked" ? (
        <p role="status" className="rounded-2xl bg-muted px-3.5 py-3 text-sm font-semibold">
          🔒 {text.locked}
        </p>
      ) : (
        status === "validated" &&
        !changed && (
          <p
            role="status"
            className="rounded-2xl bg-success-soft px-3.5 py-3 text-sm font-semibold text-success-ink"
          >
            ✓ {text.validated}
          </p>
        )
      )}

      <section aria-labelledby="stadium" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id="stadium"
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {text.stadium}
          </h2>
          <span className="font-mono text-sm font-extrabold tabular-nums">
            {text.places(filled, places.length)}
          </span>
        </div>
        {editable && <p className="text-sm text-muted-foreground">{text.hint}</p>}
        <StadiumMap label={text.stadium} places={places} spots={spots} />
      </section>

      <BottomSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={text.sheetTitle(sheetLabel)}
      >
        <p className="mb-3 text-sm text-muted-foreground">{text.sheetHint(sheetLabel)}</p>
        {open !== null && placed[open] !== null && (
          <button
            type="button"
            onClick={() => update(placed.map((id, i) => (i === open ? null : id)))}
            className={cn(buttonVariants({ variant: "outline" }), "mb-3 w-full")}
          >
            {text.remove}
          </button>
        )}
        {choices.every((c) => c.reason !== null) && (
          <p className="mb-3 rounded-card bg-muted p-3 text-sm">{text.noEligible}</p>
        )}
        <ul aria-label={text.choices} className="flex flex-col gap-2">
          {choices.map(({ athlete: a, reason, at }) => {
            const here = open !== null && at === open;
            const note =
              reason ??
              (here ? text.onThisPlace : at >= 0 ? text.elsewhere(text.place[places[at]!]) : null);
            return (
              <li key={a.athleteId}>
                <button
                  type="button"
                  disabled={reason !== null || here}
                  onClick={() =>
                    open !== null &&
                    update(seatAthlete(places, athletes, placed, a.athleteId, open))
                  }
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border px-3 py-2 text-left",
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                    reason === null && !here && "hover:bg-muted",
                    here && "border-2 border-primary",
                    reason !== null && "opacity-60",
                  )}
                >
                  <PlacedSpot
                    athlete={a}
                    className={cn("h-12 w-11 shrink-0", reason !== null && "grayscale")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-bold">{a.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {a.discipline} {messages.catalogue.sexShort[a.sex]}
                    </span>
                    {note && <span className="block text-xs font-semibold">{note}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>

      <section aria-labelledby="bench" className="flex flex-col gap-2">
        <h2 id="bench" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {text.bench}
        </h2>
        {bench.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            {athletes.length === 0 ? text.noTeam : text.benchEmpty}
          </p>
        ) : (
          <ul
            aria-labelledby="bench"
            className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6"
          >
            {bench.map((a) => (
              <li key={a.athleteId}>
                <AthleteCard athlete={a} paid={a.paid} state={a.entered ? "normal" : "absent"} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {editable && (
        <div className="sticky bottom-20 flex flex-col gap-2 rounded-2xl bg-foreground p-3 text-background shadow-lg md:bottom-3">
          <p className="text-sm font-semibold" aria-live="polite">
            {missing.size > 0
              ? text.toFill([...missing].map(([label, count]) => ({ label, count })))
              : text.full}
          </p>
          {error && (
            <p role="alert" className="text-sm font-semibold text-secondary">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={missing.size > 0 || saving}
            onClick={async () => {
              setSaving(true);
              const saved = await onValidate(lineup);
              setSaving(false);
              if (saved) setChanged(false);
            }}
            className={cn(buttonVariants(), "w-full")}
          >
            {saving ? text.validating : text.validate}
          </button>
        </div>
      )}
    </div>
  );
}
