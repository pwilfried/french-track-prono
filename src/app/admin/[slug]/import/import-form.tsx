"use client";

import { useActionState, useState } from "react";

import type { ImportEntry } from "@/application/import-start-list";
import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import type { EventGender } from "@/domain/event";
import { importReport, parseStartListCsv, type ImportLine } from "@/domain/start-list-import";

import { importStartListAction, type AdminActionState } from "../actions";

type Athlete = { athleteId: string; name: string; countryCode: string };
/** What the admin decided for one line: an athlete, a new athlete (with country), or skip. */
type Decision =
  { kind: "athlete"; athleteId: string } | { kind: "new"; countryCode: string } | { kind: "skip" };

const SKIP = "";
const field = "min-h-11 w-full rounded-xl border-2 border-border bg-background px-2.5 text-base";

function initialDecision(line: ImportLine): Decision {
  if (line.status === "matched") return { kind: "athlete", athleteId: line.athlete.athleteId };
  if (line.status === "new") return { kind: "new", countryCode: line.row.countryCode ?? "" };
  return { kind: "skip" };
}

/** Paste, check the report (matched, to confirm, new), then apply. */
export function ImportForm({
  eventId,
  slug,
  gender,
  candidates,
}: {
  eventId: string;
  slug: string;
  gender: EventGender;
  candidates: Athlete[];
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(importStartListAction, {});
  const [text, setText] = useState("");
  const [parseError, setParseError] = useState<"CSV_EMPTY" | "CSV_NO_NAME" | null>(null);
  const [lines, setLines] = useState<ImportLine[] | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  const analyse = () => {
    const parsed = parseStartListCsv(text);
    if ("error" in parsed) {
      setParseError(parsed.error);
      setLines(null);
      return;
    }
    const report = importReport(parsed.rows, candidates);
    setParseError(null);
    setLines(report);
    setDecisions(report.map(initialDecision));
  };

  const decide = (index: number, decision: Decision) =>
    setDecisions(decisions.map((d, i) => (i === index ? decision : d)));

  const entries = (lines ?? []).flatMap((line, i): ImportEntry[] => {
    const d = decisions[i];
    if (!d || d.kind === "skip") return [];
    return d.kind === "athlete"
      ? [{ athleteId: d.athleteId, seasonBest: line.row.seasonBest }]
      : [
          {
            newAthlete: { name: line.row.name, countryCode: d.countryCode },
            seasonBest: line.row.seasonBest,
          },
        ];
  });
  const count = (status: ImportLine["status"]) =>
    (lines ?? []).filter((l) => l.status === status).length;

  return (
    <div className="flex flex-col gap-4 px-4">
      <label className="flex flex-col gap-1.5 font-semibold">
        {messages.import.paste}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={messages.import.placeholder}
          className="rounded-xl border-2 border-border bg-card p-3 font-mono text-sm"
        />
      </label>
      <p className="text-sm text-muted-foreground">{messages.import.hint}</p>
      <button
        type="button"
        onClick={analyse}
        className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border bg-background px-6 font-bold"
      >
        {messages.import.analyse}
      </button>
      {parseError && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.import.errors[parseError]}
        </p>
      )}

      {lines && (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="gender" value={gender} />
          <input type="hidden" name="entries" value={JSON.stringify(entries)} />
          <p role="status" className="rounded-2xl bg-muted px-3.5 py-3 text-sm font-semibold">
            {messages.import.summary(count("matched"), count("ambiguous"), count("new"))}
          </p>
          <ol aria-label={messages.import.report} className="flex flex-col gap-2">
            {lines.map((line, i) => {
              const d = decisions[i]!;
              return (
                <li
                  key={i}
                  className="flex flex-col gap-2 rounded-card border border-border bg-card p-3"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 break-words font-mono text-sm">{line.row.name}</span>
                    <span className="shrink-0 text-xs font-bold uppercase text-muted-foreground">
                      {messages.import.status[line.status]}
                    </span>
                  </span>
                  {line.status === "matched" && (
                    <span className="font-semibold">
                      ✓ {line.athlete.name} · {line.athlete.countryCode}
                    </span>
                  )}
                  {line.status === "ambiguous" && (
                    <label className="flex flex-col gap-1 text-sm font-semibold">
                      {messages.import.choose}
                      <select
                        value={d.kind === "athlete" ? d.athleteId : SKIP}
                        onChange={(e) =>
                          decide(
                            i,
                            e.target.value === SKIP
                              ? { kind: "skip" }
                              : { kind: "athlete", athleteId: e.target.value },
                          )
                        }
                        className={field}
                      >
                        <option value={SKIP}>{messages.import.skip}</option>
                        {line.choices.map((c) => (
                          <option key={c.athleteId} value={c.athleteId}>
                            {c.name} · {c.countryCode}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {line.status === "new" && (
                    <div className="flex items-end gap-2">
                      <label className="flex min-h-11 flex-1 items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={d.kind === "new"}
                          onChange={(e) =>
                            decide(
                              i,
                              e.target.checked
                                ? { kind: "new", countryCode: line.row.countryCode ?? "" }
                                : { kind: "skip" },
                            )
                          }
                          className="size-5"
                        />
                        {messages.import.create}
                      </label>
                      {d.kind === "new" && (
                        <label className="flex w-24 flex-col gap-1 text-xs font-semibold">
                          {messages.import.country}
                          <input
                            value={d.countryCode}
                            onChange={(e) =>
                              decide(i, { kind: "new", countryCode: e.target.value.toUpperCase() })
                            }
                            maxLength={3}
                            className={`${field} font-mono uppercase`}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {state.error && (
            <p role="alert" className="text-sm font-semibold text-accent-text">
              {messages.errors[state.error]}
            </p>
          )}
          <SubmitButton pendingLabel={messages.import.applying}>
            {messages.import.apply(entries.length)}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
