"use client";

import { useActionState, useState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { PodiumPicker } from "@/components/podium/podium-picker";
import { buttonVariants } from "@/components/ui/button";
import type { Entry } from "@/domain/event";
import { isValidOfficialPodium } from "@/domain/official-result";
import type { PodiumDraft } from "@/domain/podium-draft";

import { saveResultAction, type AdminActionState } from "./actions";

type Tie = { athleteId: string; rank: 1 | 2 | 3 };

/**
 * Official result entry: the podium is composed like a prediction; a tied athlete is added on a
 * step with "Ajouter un ex æquo"; marks are optional.
 */
export function ResultForm({
  eventId,
  slug,
  athletes,
  initialDraft,
  initialTies,
  initialMarks,
}: {
  eventId: string;
  slug: string;
  athletes: Entry[];
  initialDraft: PodiumDraft;
  initialTies: Tie[];
  initialMarks: Record<string, string>;
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(saveResultAction, {});
  const [draft, setDraft] = useState(initialDraft);
  const [ties, setTies] = useState(initialTies);
  const [marks, setMarks] = useState(initialMarks);
  const [tieRank, setTieRank] = useState<1 | 2 | 3>(3);
  const [tieAthlete, setTieAthlete] = useState("");

  const onPodium = [draft.first, draft.second, draft.third];
  // An athlete placed on a step in the picker is no longer a tie.
  const activeTies = ties.filter((t) => !onPodium.includes(t.athleteId));
  const lines = [
    ...([1, 2, 3] as const).flatMap((rank) => {
      const athleteId = onPodium[rank - 1];
      return athleteId ? [{ athleteId, rank }] : [];
    }),
    ...activeTies,
  ].map((line) => ({ ...line, mark: marks[line.athleteId] ?? null }));
  const valid = isValidOfficialPodium(lines);
  const nameOf = (id: string) => athletes.find((a) => a.athleteId === id)?.name ?? id;
  const free = athletes.filter((a) => !lines.some((l) => l.athleteId === a.athleteId));
  const error = state.error ? messages.errors[state.error] : undefined;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <PodiumPicker
        athletes={athletes}
        initialDraft={initialDraft}
        onChange={setDraft}
        error={error}
        title={messages.admin.officialPodium}
      />

      <fieldset className="mx-4 flex flex-col gap-2 rounded-2xl border-2 border-dashed border-border p-3">
        <legend className="px-1 text-sm font-bold">{messages.admin.addTie}</legend>
        {activeTies.map((tie) => (
          <p key={tie.athleteId} className="flex min-h-11 items-center gap-2">
            <span className="min-w-0 flex-1 font-semibold">
              {nameOf(tie.athleteId)}{" "}
              <span className="text-sm text-accent-text">
                · {messages.admin.tieLabel(tie.rank)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setTies(ties.filter((t) => t.athleteId !== tie.athleteId))}
              aria-label={messages.admin.removeTie(nameOf(tie.athleteId))}
              className={buttonVariants({ variant: "muted" })}
            >
              ✕
            </button>
          </p>
        ))}
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs font-bold text-muted-foreground">
            {messages.admin.tieRank}
            <select
              value={tieRank}
              onChange={(e) => setTieRank(Number(e.target.value) as 1 | 2 | 3)}
              className="min-h-11 rounded-xl border-2 border-border bg-card px-2 text-base text-foreground"
            >
              {[1, 2, 3].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-1 flex-col text-xs font-bold text-muted-foreground">
            {messages.admin.tieAthlete}
            <select
              value={tieAthlete}
              onChange={(e) => setTieAthlete(e.target.value)}
              className="min-h-11 rounded-xl border-2 border-border bg-card px-2 text-base text-foreground"
            >
              <option value="">—</option>
              {free.map((a) => (
                <option key={a.athleteId} value={a.athleteId}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!tieAthlete}
            onClick={() => {
              setTies([...ties, { athleteId: tieAthlete, rank: tieRank }]);
              setTieAthlete("");
            }}
            className={buttonVariants({ variant: "outline" })}
          >
            {messages.admin.tieAdd}
          </button>
        </div>
      </fieldset>

      {lines.length > 0 && (
        <fieldset className="mx-4 flex flex-col gap-2">
          <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {messages.admin.marks}
          </legend>
          {lines.map((line) => (
            <label key={line.athleteId} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-sm font-bold">{nameOf(line.athleteId)}</span>
              <input
                value={marks[line.athleteId] ?? ""}
                onChange={(e) => setMarks({ ...marks, [line.athleteId]: e.target.value })}
                inputMode="decimal"
                maxLength={12}
                className="min-h-11 w-28 rounded-xl border-2 border-border bg-card px-2.5 text-base"
              />
            </label>
          ))}
        </fieldset>
      )}

      <div className="px-4">
        {valid ? (
          <SubmitButton pendingLabel={messages.admin.savingResult}>
            {messages.admin.saveResult}
          </SubmitButton>
        ) : (
          <button type="button" disabled className={`${buttonVariants()} w-full`}>
            {messages.admin.saveResult}
          </button>
        )}
      </div>
    </form>
  );
}
