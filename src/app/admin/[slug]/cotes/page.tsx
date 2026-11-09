import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import { getEventOdds } from "@/application/set-event-odds";
import { ErrorNotice } from "@/components/error-notice";
import { tidyMark } from "@/domain/discipline";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabaseOddsRepository,
} from "@/infra";

import { messages } from "../../../messages.fr";
import { ActionNotice, AdminShell } from "../../competitions/admin-shell";
import { adminOnly } from "../../guard";
import { OddsForm } from "./odds-form";

async function load(slug: string, client: Awaited<ReturnType<typeof adminOnly>>["client"]) {
  try {
    const event = await getEvent({
      events: createSupabaseEventReader(createPublicSupabaseClient()),
    }).execute({ competitionSlug: null, eventSlug: slug });
    const page = await getEventOdds({ odds: createSupabaseOddsRepository(client) }).execute({
      eventId: event.id,
    });
    return { event, ...page };
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "EVENT_NOT_FOUND") notFound();
      return "error" as const;
    }
    throw error;
  }
}

export default async function OddsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ enregistre?: string }>;
}) {
  const { client } = await adminOnly();
  const { slug } = await params;
  const { enregistre } = await searchParams;
  const loaded = await load(slug, client);
  const back = { href: `/admin/${slug}`, label: messages.startList.back };

  if (loaded === "error") {
    return (
      <AdminShell title={messages.odds.title} back={back}>
        <ErrorNotice
          retryHref={`/admin/${slug}/cotes`}
          message={messages.errors.ODDS_UNAVAILABLE}
        />
      </AdminShell>
    );
  }
  const { event, odds, marks } = loaded;
  // PR and SB written alike, whatever way they were typed ("11,4" → "11.40").
  const tidy = (mark: string | null) =>
    mark && event.markUnit ? tidyMark(mark, event.markUnit) : mark;
  return (
    <AdminShell
      title={messages.odds.titleOf(messages.events.name(event.discipline, event.gender))}
      back={back}
    >
      <p className="-mt-2 text-sm text-muted-foreground">{messages.odds.intro}</p>
      <p className="rounded-2xl bg-gold-soft px-3.5 py-3 text-sm font-semibold text-gold-ink">
        {messages.odds.notice}
      </p>
      <ActionNotice saved={!!enregistre} error={null} />
      <div className="-mx-4">
        <OddsForm
          eventId={event.id}
          slug={slug}
          initial={odds}
          startList={event.entries.map((e) => ({
            athleteId: e.athleteId,
            name: e.name,
            countryCode: e.countryCode,
            pr: tidy(marks.get(e.athleteId)?.pr ?? null),
            sb: tidy(marks.get(e.athleteId)?.sb ?? e.seasonBest),
          }))}
        />
      </div>
    </AdminShell>
  );
}
