"use client";

import { useActionState, useState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { flagOf } from "@/domain/flag";
import {
  PERFORMANCE_STATUSES,
  RECORD_FLAGS,
  type PerformanceStatus,
  type RecordFlag,
} from "@/domain/performance";
import { matchResults, parseResultsTable, type ResultRow } from "@/domain/result-import";

import type { AdminActionState } from "../actions";
import { savePerformancesAction } from "./actions";

/** An athlete of the start list, and what the admin entered for them ("" = nothing yet). */
export type PerformanceRow = {
  athleteId: string;
  name: string;
  countryCode: string;
  linedUp: boolean;
  status: PerformanceStatus | "";
  place: string;
  mark: string;
  records: RecordFlag[];
};

const t = messages.performances;

/**
 * The results sheet of an event (#665): one card per athlete of the start list, those lined up in
 * a Manager league first: status (finished, DNS, DNF, DQ, or not entered), place, mark and records.
 * Typing a place or a mark marks the athlete as finished; an athlete left « not entered » has no
 * line. Places 1 to 3 make the podium of the predictions; without a Manager league on the
 * competition (`manager` false) they are all it needs.
 */
export function PerformanceForm({
  eventId,
  slug,
  manager,
  initial,
}: {
  eventId: string;
  slug: string;
  manager: boolean;
  initial: PerformanceRow[];
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(savePerformancesAction, {});
  const [rows, setRows] = useState<PerformanceRow[]>(initial);
  const [pasted, setPasted] = useState("");
  const [report, setReport] = useState<{ matched: number; unmatched: ResultRow[] } | null>(null);
  const missing = rows.filter((r) => r.linedUp && r.status === "").length;

  // Pre-fills the sheet from a pasted World Athletics table (#666); nothing is saved yet.
  const prefill = () => {
    const { lines, unmatched } = matchResults(parseResultsTable(pasted), rows);
    setRows(
      rows.map((r) => {
        const line = lines.find((l) => l.athleteId === r.athleteId);
        return line
          ? {
              ...r,
              status: line.status,
              place: line.place === null ? "" : String(line.place),
              mark: line.mark ?? "",
              records: line.records,
            }
          : r;
      }),
    );
    setReport({ matched: lines.length, unmatched });
  };

  const update = (athleteId: string, change: Partial<PerformanceRow>) =>
    setRows(rows.map((r) => (r.athleteId === athleteId ? { ...r, ...change } : r)));

  const lines = rows
    .filter((r) => r.status !== "")
    .map((r) =>
      r.status === "ok"
        ? {
            athleteId: r.athleteId,
            status: r.status,
            place: r.place.trim() === "" ? null : Number(r.place),
            mark: r.mark,
            records: r.records,
          }
        : { athleteId: r.athleteId, status: r.status, place: null, mark: null, records: [] },
    );

  return (
    <form action={action} className="flex flex-col gap-4 px-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      {rows.length > 0 && (
        <details className="rounded-card border border-border bg-card p-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
            {t.paste.title}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t.paste.hint}</p>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              {t.paste.label}
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={6}
                className="rounded-xl border-2 border-border bg-background p-2 font-mono text-sm text-foreground"
              />
            </label>
            <button
              type="button"
              onClick={prefill}
              disabled={pasted.trim() === ""}
              className="min-h-11 rounded-xl border-2 border-brand px-4 font-semibold text-brand disabled:opacity-50 dark:border-secondary dark:text-secondary"
            >
              {t.paste.apply}
            </button>
            {report && (
              <div role="status" className="flex flex-col gap-1 text-sm">
                {report.matched === 0 && report.unmatched.length === 0 ? (
                  <p className="font-semibold text-accent-text">{t.paste.none}</p>
                ) : (
                  <p className="font-semibold">{t.paste.matched(report.matched)}</p>
                )}
                {report.unmatched.length > 0 && (
                  <>
                    <p className="font-semibold text-gold-ink">
                      {t.paste.unmatched(report.unmatched.length)}
                    </p>
                    <ul className="list-disc pl-5">
                      {report.unmatched.map((u, n) => (
                        <li key={n} className="break-words">
                          {u.name}
                          {u.countryCode && ` (${u.countryCode})`}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </details>
      )}

      <p
        role="status"
        className={
          missing > 0
            ? "rounded-2xl bg-gold-soft px-3.5 py-3 text-sm font-semibold text-gold-ink"
            : "rounded-2xl bg-muted px-3.5 py-3 text-sm font-semibold"
        }
      >
        {manager ? t.missing(missing, rows.filter((r) => r.linedUp).length) : t.podiumOnly}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm">{t.empty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((r) => (
            <li
              key={r.athleteId}
              aria-label={r.name}
              className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-3"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-lg">
                  {flagOf(r.countryCode)}
                </span>
                <span className="min-w-0 flex-1 break-words font-semibold">{r.name}</span>
                {r.linedUp && (
                  <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-ink">
                    {r.status === "" ? t.linedUpMissing : t.linedUp}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-[1fr_4.5rem_6.5rem] gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  {t.status}
                  <select
                    value={r.status}
                    onChange={(e) =>
                      update(r.athleteId, { status: e.target.value as PerformanceStatus | "" })
                    }
                    className="min-h-11 rounded-xl border-2 border-border bg-background px-2 text-base text-foreground"
                  >
                    <option value="">{t.statusName.none}</option>
                    {PERFORMANCE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t.statusName[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  {t.place}
                  <input
                    value={r.place}
                    disabled={r.status !== "" && r.status !== "ok"}
                    onChange={(e) =>
                      update(r.athleteId, {
                        place: e.target.value.replace(/\D/g, ""),
                        status: r.status === "" ? "ok" : r.status,
                      })
                    }
                    inputMode="numeric"
                    maxLength={3}
                    className="min-h-11 w-full rounded-xl border-2 border-border bg-background px-2 font-mono text-base text-foreground disabled:opacity-50"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  {t.mark}
                  <input
                    value={r.mark}
                    disabled={r.status !== "" && r.status !== "ok"}
                    onChange={(e) =>
                      update(r.athleteId, {
                        mark: e.target.value,
                        status: r.status === "" ? "ok" : r.status,
                      })
                    }
                    inputMode="decimal"
                    maxLength={12}
                    className="min-h-11 w-full rounded-xl border-2 border-border bg-background px-2 font-mono text-base text-foreground disabled:opacity-50"
                  />
                </label>
              </div>
              {r.status === "ok" && (
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="sr-only">{t.records(r.name)}</legend>
                  {RECORD_FLAGS.map((flag) => {
                    const on = r.records.includes(flag);
                    return (
                      <label
                        key={flag}
                        title={t.recordName[flag]}
                        className={
                          on
                            ? "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full bg-gold-soft px-3 text-sm font-bold text-gold-ink ring-2 ring-gold-ink"
                            : "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-border px-3 text-sm font-bold"
                        }
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          aria-label={t.recordName[flag]}
                          onChange={() =>
                            update(r.athleteId, {
                              records: on
                                ? r.records.filter((f) => f !== flag)
                                : [...r.records, flag],
                            })
                          }
                        />
                        {t.recordShort[flag]}
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </li>
          ))}
        </ol>
      )}

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      <SubmitButton pendingLabel={t.saving}>{t.save}</SubmitButton>
    </form>
  );
}
