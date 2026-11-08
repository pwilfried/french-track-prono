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
import { adminOnly } from "../../guard";
import { ImportForm } from "./import-form";

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

export default async function ImportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { client } = await adminOnly();
  const { slug } = await params;
  const loaded = await load(slug, client);

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
            href={`/admin/${slug}/depart`}
            className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
          >
            ‹ {messages.startList.title}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-none">
            {messages.import.title}
          </h1>
          {loaded !== "error" && (
            <p className="mt-2 text-sm text-muted-foreground">
              {loaded.event.discipline} {messages.events.gender[loaded.event.gender].toLowerCase()}
            </p>
          )}
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-5">
        {loaded === "error" ? (
          <div className="px-4">
            <ErrorNotice
              retryHref={`/admin/${slug}/import`}
              message={messages.errors.START_LIST_UNAVAILABLE}
            />
          </div>
        ) : (
          <ImportForm
            eventId={loaded.event.id}
            slug={slug}
            gender={loaded.event.gender}
            candidates={loaded.candidates}
          />
        )}
      </div>
    </main>
  );
}
