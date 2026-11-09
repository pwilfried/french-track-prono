import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import { listStartListCandidates } from "@/application/list-start-list-candidates";
import { ErrorNotice } from "@/components/error-notice";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabaseStartListRepository,
} from "@/infra";

import { messages } from "../../../messages.fr";
import { AdminBand } from "../../competitions/admin-shell";
import { adminOnly } from "../../guard";
import { StartListForm } from "./start-list-form";

async function load(slug: string, client: Awaited<ReturnType<typeof adminOnly>>["client"]) {
  try {
    const event = await getEvent({
      events: createSupabaseEventReader(createPublicSupabaseClient()),
    }).execute({ competitionSlug: null, eventSlug: slug });
    const candidates = await listStartListCandidates({
      startLists: createSupabaseStartListRepository(client),
    }).execute({ gender: event.gender, discipline: event.discipline, eventId: event.id });
    return { event, candidates };
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "EVENT_NOT_FOUND") notFound();
      return "error" as const;
    }
    throw error;
  }
}

export default async function StartListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ enregistre?: string }>;
}) {
  const { client } = await adminOnly();
  const { slug } = await params;
  const saved = (await searchParams).enregistre === "1";
  const loaded = await load(slug, client);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <AdminBand />
      <header className="px-4 pt-4">
        <div className="mx-auto max-w-md">
          <Link
            href={`/admin/${slug}`}
            className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
          >
            ‹ {messages.startList.back}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-none">
            {messages.startList.title}
          </h1>
          <Link
            href={`/admin/${slug}/import`}
            className="mt-2 inline-flex min-h-11 items-center rounded-full bg-brand-soft px-4 text-sm font-bold text-brand-ink"
          >
            {messages.import.link}
          </Link>
          {loaded !== "error" && (
            <p className="mt-2 text-sm text-muted-foreground">
              {messages.events.name(loaded.event.discipline, loaded.event.gender)}
            </p>
          )}
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-5">
        {loaded === "error" ? (
          <div className="px-4">
            <ErrorNotice
              retryHref={`/admin/${slug}/depart`}
              message={messages.errors.START_LIST_UNAVAILABLE}
            />
          </div>
        ) : (
          <>
            {saved && (
              <p
                role="status"
                className="mx-4 rounded-2xl bg-success/15 px-3.5 py-3 text-sm font-semibold text-success-text"
              >
                {messages.startList.saved(loaded.event.entries.length)}
              </p>
            )}
            <StartListForm
              eventId={loaded.event.id}
              slug={slug}
              candidates={loaded.candidates}
              discipline={loaded.event.discipline}
              initial={loaded.event.entries.map((e) => ({
                athleteId: e.athleteId,
                name: e.name,
                countryCode: e.countryCode,
                seasonBest: e.seasonBest ?? "",
              }))}
            />
          </>
        )}
      </div>
    </main>
  );
}
