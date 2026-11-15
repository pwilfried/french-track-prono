import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getChallenge } from "@/application/frenchtrack";
import { getEvent } from "@/application/get-event";
import { ErrorNotice } from "@/components/error-notice";
import { eventPhase } from "@/domain/countdown";
import { flagOf } from "@/domain/flag";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabaseFrenchTrackRepository,
} from "@/infra";

import { messages } from "../../../messages.fr";
import { ActionNotice, AdminShell } from "../../competitions/admin-shell";
import { adminOnly } from "../../guard";
import { FrenchTrackPickForm } from "./pick-form";

const text = messages.challenge.admin;

async function load(slug: string, client: Awaited<ReturnType<typeof adminOnly>>["client"]) {
  try {
    const event = await getEvent({
      events: createSupabaseEventReader(createPublicSupabaseClient()),
    }).execute({ competitionSlug: null, eventSlug: slug });
    const challenge = await getChallenge({
      frenchTrack: createSupabaseFrenchTrackRepository(client),
    }).execute({ eventId: event.id });
    return { event, challenge };
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "EVENT_NOT_FOUND") notFound();
      return "error" as const;
    }
    throw error;
  }
}

/** « Battez FrenchTrack » (#674): the admin posts FrenchTrack's podium before the lock. */
export default async function FrenchTrackPickPage({
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
      <AdminShell title={text.link} back={back}>
        <ErrorNotice
          retryHref={`/admin/${slug}/frenchtrack`}
          message={messages.errors.FRENCHTRACK_UNAVAILABLE}
        />
      </AdminShell>
    );
  }
  const { event, challenge } = loaded;
  const locked = eventPhase(new Date(), event.lockAt) === "locked";
  const name = (id: string) => event.entries.find((e) => e.athleteId === id);

  return (
    <AdminShell
      title={text.title(messages.events.name(event.discipline, event.gender))}
      back={back}
    >
      <p className="-mt-2 text-sm text-muted-foreground">{text.intro}</p>
      <ActionNotice saved={!!enregistre} error={null} />
      {locked ? (
        <div className="flex flex-col gap-2 rounded-card bg-muted p-4 text-sm">
          <p className="font-semibold">{text.locked}</p>
          {challenge?.podium ? (
            <ol className="flex flex-col gap-1">
              {(["first", "second", "third"] as const).map((place, index) => {
                const athlete = name(challenge.podium![place]);
                return (
                  <li key={place}>
                    {index + 1}. {athlete ? flagOf(athlete.countryCode) : null}{" "}
                    {athlete?.name ?? "?"}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p>{text.none}</p>
          )}
        </div>
      ) : event.entries.length < 3 ? (
        <p className="rounded-card bg-muted p-4 text-sm">{text.emptyStartList}</p>
      ) : (
        <FrenchTrackPickForm
          eventId={event.id}
          slug={slug}
          startList={event.entries}
          initial={challenge?.podium ?? null}
        />
      )}
    </AdminShell>
  );
}
