"use client";

import { useState, useTransition } from "react";

import type { MomentReport } from "@/application/moment-reactions";
import { messages } from "@/app/messages.fr";
import { isMomentEmoji, isPresetMessage } from "@/domain/moment-reactions";

import {
  dismissMomentReportsAction,
  hideMomentReactionAction,
  type LeagueListResult,
} from "./actions";

const text = messages.adminLeagues.feedReports;
const feed = messages.leagues.feed;

/** « Bien joué ! » for a message, 🔥 for an emoji. */
const whatOf = (report: MomentReport) =>
  report.kind === "message" && isPresetMessage(report.code)
    ? `« ${feed.reactions.messages[report.code]} »`
    : isMomentEmoji(report.code)
      ? feed.reactions.emoji[report.code]
      : report.code;

/**
 * The reported reactions and messages of the leagues' feeds (#672): the admin hides one (gone for
 * everyone) or dismisses its reports. The players hide nothing.
 */
export function FeedReports({ reports }: { reports: MomentReport[] }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ message?: string; error?: string }>({});

  const run = (work: () => Promise<LeagueListResult>, done: string) =>
    start(async () => {
      setStatus({});
      const result = await work();
      setStatus(result.error ? { error: messages.errors[result.error] } : { message: done });
    });

  return (
    <section aria-labelledby="feed-reports" className="flex flex-col gap-2">
      <h2 id="feed-reports" className="font-display text-lg font-extrabold">
        {text.title}
      </h2>
      <p className="text-sm text-muted-foreground">{text.hint}</p>
      <p role="status" className="text-sm font-semibold empty:hidden">
        {pending ? text.pending : (status.message ?? "")}
      </p>
      {status.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {status.error}
        </p>
      )}
      {reports.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.empty}</p>
      ) : (
        <ul aria-label={text.title} className="flex flex-col gap-2">
          {reports.map((report) => {
            const what = whatOf(report);
            return (
              <li
                key={report.id}
                className="flex flex-col gap-2 rounded-2xl border-2 border-primary/40 p-3.5"
              >
                <p className="break-words font-bold">{text.item(report.pseudo, what)}</p>
                <p className="break-words text-sm text-muted-foreground">
                  {text.context(report.leagueName, feed.label[report.momentKind], report.reports)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={text.hideLabel(what, report.pseudo)}
                    onClick={() => run(() => hideMomentReactionAction(report.id), text.hidden)}
                    className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
                  >
                    {text.hide}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={text.dismissLabel(what, report.pseudo)}
                    onClick={() => run(() => dismissMomentReportsAction(report.id), text.dismissed)}
                    className="inline-flex min-h-11 items-center rounded-full border-2 border-border px-4 text-sm font-bold disabled:opacity-60"
                  >
                    {text.dismiss}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
