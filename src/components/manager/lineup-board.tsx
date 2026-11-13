"use client";

import { useState, type DragEvent } from "react";

import { messages } from "@/app/messages.fr";
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

const DRAG_TYPE = "text/plain";

/**
 * The lineup of a Manager team before a competition (#427), as a stadium: a running track around a
 * field holds the places, each one of a family or free (the rules of the league). The athletes of
 * the team who are not lined up wait on the bench below; one not entered in the competition is
 * greyed « Absent·e » and cannot be lined up. Drag a card from the bench onto a place (mouse), or
 * tap a card then a place: the places it fits light up. Tap a card of the stadium to send it back
 * to the bench. Every gesture is a button, so the keyboard does it all too. « Valider mon
 * alignement » turns on once every place the team can fill is filled. Validated: a banner, still
 * editable until the lock. Locked: read only.
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
  const [picked, setPicked] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const editable = status !== "locked" && onValidate !== undefined;
  const byId = new Map(athletes.map((a) => [a.athleteId, a]));
  const pickedAthlete = picked ? byId.get(picked) : undefined;

  const seat = (athleteId: string, at: number) => {
    const next = seatAthlete(places, athletes, placed, athleteId, at);
    if (next !== placed) {
      setPlaced(next);
      setChanged(true);
    }
    setPicked(null);
  };
  const unseat = (at: number) => {
    setPlaced(placed.map((id, i) => (i === at ? null : id)));
    setChanged(true);
  };
  const lights = (place: LineupPlace, i: number) =>
    pickedAthlete !== undefined && fillable[i] === true && fitsPlace(place, pickedAthlete.family);

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
        {/* The track, then the field: the places sit on the grass. */}
        <div className="rounded-[2.5rem] bg-track p-3 shadow-inner">
          <ul
            aria-labelledby="stadium"
            className="grid grid-cols-4 gap-2 rounded-[2rem] bg-field p-3 sm:gap-3 md:grid-cols-8"
          >
            {places.map((place, i) => {
              const athlete = placed[i] ? byId.get(placed[i]!) : undefined;
              const label = text.place[place];
              const lit = editable && lights(place, i);
              return (
                <li
                  key={i}
                  className="relative"
                  onDragOver={(e) => {
                    if (lit) e.preventDefault();
                  }}
                  onDrop={(e: DragEvent) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData(DRAG_TYPE);
                    if (id) seat(id, i);
                  }}
                >
                  {athlete ? (
                    <AthleteCard athlete={athlete} paid={athlete.paid} compact />
                  ) : (
                    <div
                      className={cn(
                        "grid aspect-[3/4] place-items-center rounded-xl border-2 border-dashed p-1 text-center text-[11px] font-bold leading-tight",
                        fillable[i]
                          ? "border-white/70 text-field-foreground"
                          : "border-white/30 bg-black/20 text-field-foreground/70",
                        lit &&
                          "border-solid border-secondary bg-secondary/30 motion-safe:animate-pulse",
                      )}
                    >
                      <span>
                        {label}
                        {!fillable[i] && <span className="block font-semibold">{text.nobody}</span>}
                      </span>
                    </div>
                  )}
                  {editable && (athlete || lit) && (
                    <button
                      type="button"
                      aria-label={
                        athlete ? text.takenPlace(label, athlete.name) : text.emptyPlace(label)
                      }
                      onClick={() => (athlete && !lit ? unseat(i) : picked && seat(picked, i))}
                      className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                    />
                  )}
                  {(!editable || (!athlete && !lit)) && (
                    <span className="sr-only">
                      {athlete
                        ? text.lockedPlace(label, athlete.name)
                        : fillable[i]
                          ? text.emptyPlace(label)
                          : text.unfillablePlace(label)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="bench" className="flex flex-col gap-2">
        <h2 id="bench" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {text.bench}
        </h2>
        {editable && <p className="text-sm text-muted-foreground">{text.hint}</p>}
        {bench.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            {athletes.length === 0 ? text.noTeam : text.benchEmpty}
          </p>
        ) : (
          <ul
            aria-labelledby="bench"
            className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6"
          >
            {bench.map((a) => {
              const canPick = editable && a.entered;
              return (
                <li
                  key={a.athleteId}
                  className="relative"
                  draggable={canPick}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, a.athleteId);
                    setPicked(a.athleteId);
                  }}
                  onDragEnd={() => setPicked(null)}
                >
                  <AthleteCard
                    athlete={a}
                    paid={a.paid}
                    state={!a.entered ? "absent" : picked === a.athleteId ? "selected" : "normal"}
                  />
                  {canPick && (
                    <button
                      type="button"
                      aria-label={a.name}
                      aria-pressed={picked === a.athleteId}
                      onClick={() => setPicked(picked === a.athleteId ? null : a.athleteId)}
                      className="absolute inset-0 rounded-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                    />
                  )}
                </li>
              );
            })}
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
            {text.validate}
          </button>
        </div>
      )}
    </div>
  );
}
