import Link from "next/link";
import { notFound } from "next/navigation";

import { getPerformanceSheet } from "@/application/enter-performances";
import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import { ErrorNotice } from "@/components/error-notice";
import { eventPhase } from "@/domain/countdown";
import { createPublicSupabaseClient, createSupabaseEventReader } from "@/infra";

import { messages } from "../../../messages.fr";
import { AdminBand } from "../../competitions/admin-shell";
import { adminOnly } from "../../guard";
import { sheetPorts } from "../sheet-ports";
import { PerformanceForm, type PerformanceRow } from "./performance-form";

async function load(slug: string, client: Awaited<ReturnType<typeof adminOnly>>["client"]) {
  try {
    const event = await getEvent({
      events: createSupabaseEventReader(createPublicSupabaseClient()),
    }).execute({ competitionSlug: null, eventSlug: slug });
    const sheet = await getPerformanceSheet(sheetPorts(client)).execute({
      eventId: event.id,
      competitionSlug: event.competitionSlug ?? null,
    });
    return { event, sheet };
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "EVENT_NOT_FOUND") notFound();
      return "error" as const;
    }
    throw error;
  }
}

/** The one results sheet of an event (#665): the podium of the predictions and the Manager marks. */
export default async function PerformancesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { client } = await adminOnly();
  const { slug } = await params;
  const loaded = await load(slug, client);
  const t = messages.performances;

  let rows: PerformanceRow[] = [];
  if (loaded !== "error") {
    const linedUp = new Set(loaded.sheet.linedUp);
    // A podium entered before the sheet existed (#665) starts it, so a correction keeps it.
    const performances =
      loaded.sheet.performances.length > 0
        ? loaded.sheet.performances
        : loaded.event.results.map((r) => ({
            athleteId: r.athleteId,
            status: "ok" as const,
            place: r.rank,
            mark: r.mark,
            records: [],
          }));
    rows = loaded.event.entries
      .map((entry): PerformanceRow => {
        const line = performances.find((p) => p.athleteId === entry.athleteId);
        return {
          athleteId: entry.athleteId,
          name: entry.name,
          countryCode: entry.countryCode,
          linedUp: linedUp.has(entry.athleteId),
          status: line?.status ?? "",
          place: line?.place === null || line === undefined ? "" : String(line.place),
          mark: line?.mark ?? "",
          records: line?.records ?? [],
        };
      })
      // Lined-up athletes first: their performances must not be missing.
      .sort((a, b) => Number(b.linedUp) - Number(a.linedUp) || a.name.localeCompare(b.name));
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <AdminBand />
      <header className="px-4 pt-4">
        <div className="mx-auto max-w-md">
          <Link
            href={`/admin/${slug}`}
            className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
          >
            ‹ {t.back}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-none">{t.title}</h1>
          {loaded !== "error" && (
            <p className="mt-2 text-sm text-muted-foreground">
              {messages.events.name(loaded.event.discipline, loaded.event.gender)}
            </p>
          )}
          <p className="mt-2 text-sm">{t.intro}</p>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-5">
        {loaded === "error" ? (
          <div className="px-4">
            <ErrorNotice
              retryHref={`/admin/${slug}/performances`}
              message={messages.errors.PERFORMANCES_UNAVAILABLE}
            />
          </div>
        ) : eventPhase(new Date(), loaded.event.lockAt) !== "locked" ? (
          <p className="mx-4 rounded-card bg-muted p-4">{messages.errors.EVENT_NOT_LOCKED}</p>
        ) : (
          <PerformanceForm
            eventId={loaded.event.id}
            slug={slug}
            manager={loaded.sheet.manager}
            unit={loaded.event.markUnit ?? "time"}
            family={loaded.event.markFamily}
            initial={rows}
          />
        )}
      </div>
    </main>
  );
}
