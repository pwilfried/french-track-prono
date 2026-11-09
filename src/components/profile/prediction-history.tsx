import Link from "next/link";

import { messages } from "@/app/messages.fr";
import type { MyPredictionLine } from "@/application/list-my-predictions";
import type { PickHit } from "@/domain/prediction-history";

const text = messages.predictionHistory;
const medals = ["🥇", "🥈", "🥉"];
const mark: Record<PickHit, { icon: string; className: string }> = {
  exact: { icon: "✓", className: "text-success-text" },
  misplaced: { icon: "≈", className: "text-gold-ink dark:text-secondary" },
  missed: { icon: "✗", className: "text-muted-foreground" },
  pending: { icon: "", className: "" },
};

/** One prediction: the event, my three picks with how each turned out, the points (#387). */
export function PredictionLineCard({ line }: { line: MyPredictionLine }) {
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(line.startsAt));
  return (
    <Link
      href={`/epreuves/${line.eventSlug}`}
      className="flex flex-col gap-2 rounded-card border border-border bg-card p-3.5"
    >
      <span className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block break-words font-extrabold">
            {line.discipline} {messages.events.gender[line.gender].toLowerCase()}
          </span>
          <span className="text-xs text-muted-foreground">
            {date}
            {line.joker ? ` · ${text.joker}` : ""}
          </span>
        </span>
        <span
          className={`shrink-0 text-lg font-extrabold ${
            line.points === null
              ? "text-sm text-muted-foreground"
              : line.points > 0
                ? "text-success-text"
                : "text-muted-foreground"
          }`}
        >
          {line.points === null ? text.pending : messages.points.line(line.points)}
        </span>
      </span>
      <ol className="flex flex-col gap-1 text-sm">
        {line.picks.map((pick, i) => (
          <li key={i} className="flex items-center gap-2">
            <span aria-hidden="true">{medals[i]}</span>
            <span className="min-w-0 flex-1 break-words">{pick.name ?? text.other}</span>
            {pick.hit !== "pending" && (
              <span className={`font-bold ${mark[pick.hit].className}`}>
                <span aria-hidden="true">{mark[pick.hit].icon}</span>
                <span className="sr-only">{text.hit[pick.hit]}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </Link>
  );
}

/** « Mes derniers pronos » on the profile: the latest three and a link to all of them. */
export function LatestPredictions({ lines }: { lines: MyPredictionLine[] }) {
  return (
    <section aria-labelledby="latest-predictions" className="flex flex-col gap-2">
      <h2
        id="latest-predictions"
        className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
      >
        {text.latest}
      </h2>
      {lines.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <li key={`${line.competitionSlug}/${line.eventSlug}`}>
              <PredictionLineCard line={line} />
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/profil/pronos"
        className="flex min-h-11 items-center justify-between rounded-card border border-border bg-card px-4 font-semibold"
      >
        {text.all}
        <span aria-hidden="true">›</span>
      </Link>
    </section>
  );
}
