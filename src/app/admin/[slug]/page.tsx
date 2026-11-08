import Link from "next/link";
import { notFound } from "next/navigation";

import { computeEventPoints, type ScoreLine } from "@/application/compute-event-points";
import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import { ErrorNotice } from "@/components/error-notice";
import { PodiumMedals } from "@/components/podium/podium-medals";
import { buttonVariants } from "@/components/ui/button";
import { eventPhase } from "@/domain/countdown";
import type { EventDetail } from "@/domain/event";
import { missingPodiumRanks } from "@/domain/official-result";
import type { PodiumDraft } from "@/domain/podium-draft";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePointsRepository,
  createSupabaseProfileRepository,
} from "@/infra";

import { COMPETITION_TIME_ZONE } from "../../competition";
import { messages } from "../../messages.fr";
import { adminOnly } from "../guard";
import { ComputeForm } from "./compute-form";
import { PromoteForm } from "./promote-form";
import { ResultForm } from "./result-form";
import { ScoreTable, type Scored } from "./score-table";

type Loaded = {
  event: EventDetail;
  /** The stored points of the event, best first. */
  scores: Scored[];
  /** Before any computation: the points a computation would store, best first (dry run). */
  preview: Scored[];
};

async function load(
  slug: string,
  client: Awaited<ReturnType<typeof adminOnly>>["client"],
): Promise<Loaded | "error"> {
  try {
    const event = await getEvent({
      events: createSupabaseEventReader(createPublicSupabaseClient()),
    }).execute({ competitionSlug: null, eventSlug: slug });
    const points = createSupabasePointsRepository(client);
    const lines = await points.findEventScores(event.id);
    const canPreview =
      lines.length === 0 &&
      event.results.length > 0 &&
      missingPodiumRanks(event.results).length === 0 &&
      eventPhase(new Date(), event.lockAt) === "locked";
    const previewLines = canPreview
      ? await computeEventPoints({ points }).execute({ eventId: event.id, dryRun: true })
      : [];
    // One profile read per player: fine for the size of a league of friends.
    const profiles = createSupabaseProfileRepository(client);
    const withPseudo = async (rows: ScoreLine[]) =>
      (
        await Promise.all(
          rows.map(async (line) => ({
            ...line,
            pseudo: (await profiles.find(line.userId))?.pseudo ?? "?",
          })),
        )
      ).sort((a, b) => b.points - a.points);
    return { event, scores: await withPseudo(lines), preview: await withPseudo(previewLines) };
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "EVENT_NOT_FOUND") notFound();
      return "error";
    }
    throw error;
  }
}

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ corriger?: string }>;
}) {
  const { client } = await adminOnly();
  const { slug } = await params;
  const correcting = (await searchParams).corriger === "1";
  const loaded = await load(slug, client);

  if (loaded === "error") {
    return (
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <ErrorNotice retryHref={`/admin/${slug}`} message={messages.errors.RESULTS_UNAVAILABLE} />
      </main>
    );
  }

  const { event, scores, preview } = loaded;
  const locked = eventPhase(new Date(), event.lockAt) === "locked";
  const hasResult = event.results.length > 0;
  const scored = scores.length > 0;
  const missing = missingPodiumRanks(event.results);
  const when = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: COMPETITION_TIME_ZONE,
  }).format(new Date(event.startsAt));

  // The form starts from the current result: first athlete of each rank on the steps, the others as ties.
  const firstOf = (rank: number) => event.results.find((r) => r.rank === rank)?.athleteId ?? null;
  const draft: PodiumDraft = { first: firstOf(1), second: firstOf(2), third: firstOf(3) };
  const onSteps = [draft.first, draft.second, draft.third];
  const ties = event.results
    .filter((r) => !onSteps.includes(r.athleteId) && r.rank <= 3)
    .map((r) => ({ athleteId: r.athleteId, rank: r.rank as 1 | 2 | 3 }));
  const marks = Object.fromEntries(event.results.map((r) => [r.athleteId, r.mark ?? ""]));

  return (
    <main id="main" className="flex flex-1 flex-col">
      <p
        role="note"
        className="bg-primary px-4 py-1 text-center text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary-foreground"
      >
        {messages.admin.band}
      </p>
      <header className="px-4 pt-4">
        <div className="mx-auto max-w-md">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
          >
            ‹ {messages.admin.back}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-none">
            {event.discipline} {messages.events.gender[event.gender].toLowerCase()}
          </h1>
          {event.round !== "final" && (
            <p className="mt-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {messages.rounds.name[event.round]}
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground first-letter:uppercase">
            {when.replace(" à ", " · ")}
          </p>
          <Link
            href={`/admin/${slug}/depart`}
            className="mt-2 inline-flex min-h-11 items-center rounded-full bg-brand-soft px-4 text-sm font-bold text-brand-ink"
          >
            {messages.startList.link(event.entries.length)}
          </Link>
          <Link
            href={`/admin/${slug}/cotes`}
            className="ml-2 mt-2 inline-flex min-h-11 items-center rounded-full bg-gold-soft px-4 text-sm font-bold text-gold-ink"
          >
            {messages.odds.link}
          </Link>
          {event.previousRounds.length > 0 && (
            <nav aria-label={messages.rounds.previousLinks} className="mt-2 flex flex-wrap gap-2">
              {event.previousRounds.map((round, index) => (
                <Link
                  key={round.slug}
                  href={`/admin/${round.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold"
                >
                  {messages.rounds.label(round.round, index + 1)}
                </Link>
              ))}
            </nav>
          )}
          {hasResult && !correcting && (
            <div className="mt-4 rounded-card border border-border bg-card p-4">
              <PodiumMedals results={event.results} />
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-6">
        {!locked ? (
          <p className="mx-4 rounded-card bg-muted p-4">{messages.errors.EVENT_NOT_LOCKED}</p>
        ) : !hasResult || correcting ? (
          <ResultForm
            eventId={event.id}
            slug={slug}
            athletes={event.entries}
            initialDraft={draft}
            initialTies={ties}
            initialMarks={marks}
          />
        ) : (
          <div className="flex flex-col gap-3 px-4">
            <p
              role="status"
              className="rounded-2xl bg-success/15 px-3.5 py-3 text-sm font-semibold text-success-text"
            >
              {scored ? messages.admin.computed(scores.length) : messages.admin.resultSaved}
            </p>
            {scored ? (
              <ScoreTable lines={scores} title={messages.admin.detail} />
            ) : missing.length > 0 ? (
              <p role="alert" className="rounded-card bg-muted p-4 text-sm font-semibold">
                {messages.admin.missingRanks(missing)}
              </p>
            ) : preview.length === 0 ? (
              <p className="rounded-card bg-muted p-4 text-sm">{messages.admin.noPrediction}</p>
            ) : (
              <section aria-labelledby="preview-title" className="flex flex-col gap-3">
                <h2 id="preview-title" className="font-display text-xl font-extrabold">
                  {messages.admin.preview.title}
                </h2>
                <p className="text-sm text-muted-foreground">{messages.admin.preview.note}</p>
                <ScoreTable lines={preview} title={messages.admin.preview.detail} />
              </section>
            )}
            {event.round !== "final" ? (
              <PromoteForm eventId={event.id} slug={slug} />
            ) : (
              missing.length === 0 && <ComputeForm eventId={event.id} slug={slug} again={scored} />
            )}
            <Link
              href={`/admin/${slug}?corriger=1`}
              className={`${buttonVariants({ variant: "muted" })} w-full`}
            >
              {messages.admin.correct}
            </Link>
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
              {messages.admin.computeNote}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
