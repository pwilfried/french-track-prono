"use client";

import { useActionState, useState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { flagOf } from "@/domain/flag";
import { firstInvalidOdds } from "@/domain/odds";
import { OTHER_ATHLETE } from "@/domain/podium-draft";

import { saveOddsAction, type AdminActionState } from "../actions";

type Athlete = {
  athleteId: string;
  name: string;
  countryCode: string;
  pr: string | null;
  sb: string | null;
};
type Row = Athlete & { odds: string };

const oddsField = (wrong: boolean) =>
  `min-h-11 w-full rounded-[10px] border-2 bg-background px-2 text-right font-mono text-[15px] font-bold ${
    wrong ? "border-primary" : "border-border"
  }`;

/** The admin picks athletes of the start list (as many as he wants) and types each one's odds, plus another athlete's. */
export function OddsForm({
  eventId,
  slug,
  startList,
  initial,
}: {
  eventId: string;
  slug: string;
  startList: Athlete[];
  initial: { proposed: { athleteId: string; odds: number }[]; other: number } | null;
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(saveOddsAction, {});
  const [rows, setRows] = useState<Row[]>(
    (initial?.proposed ?? []).flatMap((p) => {
      const athlete = startList.find((a) => a.athleteId === p.athleteId);
      return athlete ? [{ ...athlete, odds: String(p.odds) }] : [];
    }),
  );
  const [other, setOther] = useState(initial ? String(initial.other) : "");
  const rest = startList.filter((a) => !rows.some((r) => r.athleteId === a.athleteId));
  // The line found wrong at the last try (athlete id or OTHER_ATHLETE), checked before sending.
  const [wrong, setWrong] = useState<string | null>(null);
  const wrongName =
    wrong === OTHER_ATHLETE ? messages.odds.other : rows.find((r) => r.athleteId === wrong)?.name;
  const marks = (a: Athlete) => (
    <>
      <span className="text-right font-mono text-[13px]">{a.pr ?? "—"}</span>
      <span className="text-right font-mono text-[13px]">{a.sb ?? "—"}</span>
    </>
  );

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const found = firstInvalidOdds(
          rows.map((r) => ({ athleteId: r.athleteId, text: r.odds })),
          other,
        );
        setWrong(found);
        if (found || rows.length === 0) e.preventDefault();
      }}
      className="flex flex-col gap-4 px-4"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <input
        type="hidden"
        name="startList"
        value={JSON.stringify(startList.map((a) => a.athleteId))}
      />
      <input
        type="hidden"
        name="odds"
        value={JSON.stringify({
          proposed: rows.map((r) => ({ athleteId: r.athleteId, odds: r.odds })),
          other,
        })}
      />

      <section aria-labelledby="proposed-title" className="flex flex-col gap-2">
        <h2
          id="proposed-title"
          className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          <span>{messages.odds.proposed}</span>
          <span className="font-mono">{messages.odds.count(rows.length)}</span>
        </h2>
        <div
          aria-hidden="true"
          className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_4.75rem_2.75rem] gap-1.5 px-2.5 text-[11px] font-bold uppercase text-muted-foreground"
        >
          <span>{messages.odds.athlete}</span>
          <span className="text-right">{messages.athlete.pr}</span>
          <span className="text-right">{messages.athlete.sb}</span>
          <span className="text-right">{messages.odds.odds}</span>
          <span />
        </div>
        {rows.length === 0 && (
          <p className="rounded-card bg-muted p-4 text-sm">{messages.odds.none}</p>
        )}
        <ol className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li
              key={r.athleteId}
              className="grid min-h-14 grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_4.75rem_2.75rem] items-center gap-1.5 rounded-2xl border border-border bg-card py-1.5 pl-2.5"
            >
              <span className="min-w-0 break-words text-sm font-bold">
                {r.name} <span className="font-medium text-muted-foreground">{r.countryCode}</span>
              </span>
              {marks(r)}
              <input
                aria-label={messages.odds.oddsOf(r.name)}
                value={r.odds}
                onChange={(e) =>
                  setRows(
                    rows.map((o) =>
                      o.athleteId === r.athleteId ? { ...o, odds: e.target.value } : o,
                    ),
                  )
                }
                inputMode="decimal"
                aria-invalid={wrong === r.athleteId || undefined}
                className={oddsField(wrong === r.athleteId)}
              />
              <button
                type="button"
                aria-label={messages.odds.remove(r.name)}
                onClick={() => setRows(rows.filter((o) => o.athleteId !== r.athleteId))}
                className="grid size-11 place-items-center rounded-full text-muted-foreground"
              >
                ✕
              </button>
            </li>
          ))}
          <li className="grid min-h-14 grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_4.75rem_2.75rem] items-center gap-1.5 rounded-2xl border border-brand-soft bg-brand-soft py-1.5 pl-2.5 text-brand-ink">
            <span className="text-sm font-bold">{messages.odds.other}</span>
            <span />
            <span />
            <input
              aria-label={messages.odds.otherOdds}
              value={other}
              onChange={(e) => setOther(e.target.value)}
              inputMode="decimal"
              aria-invalid={wrong === OTHER_ATHLETE || undefined}
              className={oddsField(wrong === OTHER_ATHLETE)}
            />
            <span />
          </li>
        </ol>
      </section>

      <section aria-labelledby="rest-title" className="flex flex-col gap-1.5">
        <h2
          id="rest-title"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {messages.odds.rest}
        </h2>
        {rest.length === 0 ? (
          <p className="text-sm text-muted-foreground">{messages.odds.restEmpty}</p>
        ) : (
          <ul className="flex flex-col">
            {rest.map((a) => (
              <li
                key={a.athleteId}
                className="flex min-h-13 items-center gap-2.5 border-b border-border py-1 pl-1"
              >
                <span aria-hidden="true">{flagOf(a.countryCode)}</span>
                <span className="min-w-0 flex-1 break-words text-sm font-semibold">
                  {a.name}{" "}
                  <span className="font-medium text-muted-foreground">
                    {[
                      a.pr && messages.picker.personalBest(a.pr),
                      a.sb && messages.picker.seasonBest(a.sb),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setRows([...rows, { ...a, odds: "" }])}
                  className="min-h-11 rounded-full bg-brand-soft px-3.5 text-[13px] font-bold text-brand-ink"
                >
                  {messages.odds.propose}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">{messages.odds.rule}</p>
      {wrongName ? (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.odds.invalid(wrongName)}
        </p>
      ) : null}
      {!wrongName && state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      <SubmitButton pendingLabel={messages.startList.saving}>{messages.odds.save}</SubmitButton>
    </form>
  );
}
