import Link from "next/link";
import { redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getMyPoints, type MyPoints } from "@/application/get-my-points";
import { listEvents } from "@/application/list-events";
import { AccountHero } from "@/components/account/account-hero";
import { ErrorNotice } from "@/components/error-notice";
import { buttonVariants } from "@/components/ui/button";
import type { EventSummary } from "@/domain/event";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePointsRepository,
} from "@/infra";

import { COMPETITION_SLUG, COMPETITION_TEXT } from "../competition";
import { messages } from "../messages.fr";
import { pointsReasonLabels } from "../points-labels";
import { getCurrentUser, getSessionClient } from "../session";

async function load(userId: string): Promise<{ mine: MyPoints; events: EventSummary[] } | "error"> {
  try {
    const [mine, events] = await Promise.all([
      getMyPoints({
        points: createSupabasePointsRepository(await getSessionClient()),
      }).execute({ userId, competitionSlug: COMPETITION_SLUG }),
      listEvents({ events: createSupabaseEventReader(createPublicSupabaseClient()) }).execute({
        competitionSlug: COMPETITION_SLUG,
      }),
    ]);
    return { mine, events };
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) return "error";
    throw error;
  }
}

export default async function MyPointsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/mes-points")}`);
  const loaded = await load(user.userId);

  return (
    <main className="flex flex-1 flex-col">
      <AccountHero title={messages.points.title} subtitle={COMPETITION_TEXT.name} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6">
        {loaded === "error" ? (
          <ErrorNotice retryHref="/mes-points" message={messages.errors.POINTS_UNAVAILABLE} />
        ) : (
          <MyPointsList mine={loaded.mine} events={loaded.events} />
        )}
      </div>
    </main>
  );
}

function MyPointsList({ mine, events }: { mine: MyPoints; events: EventSummary[] }) {
  const byId = new Map(events.map((event) => [event.id, event]));
  // In the order of the competition programme.
  const lines = [...mine.events].sort(
    (a, b) =>
      Date.parse(byId.get(a.eventId)?.startsAt ?? "") -
      Date.parse(byId.get(b.eventId)?.startsAt ?? ""),
  );

  return (
    <>
      <p className="flex items-baseline gap-3 rounded-card border border-border bg-card p-5">
        <span className="font-display text-5xl font-extrabold leading-none">{mine.total}</span>
        <span className="font-semibold text-muted-foreground">
          {messages.points.total(mine.total, lines.length)}
        </span>
      </p>

      {lines.length === 0 ? (
        <>
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            <strong className="block text-foreground">{messages.points.emptyTitle}</strong>
            {messages.points.emptyText}
          </p>
          <Link href="/epreuves" className={`${buttonVariants()} w-full`}>
            {messages.points.seeEvents}
          </Link>
        </>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => {
            const event = byId.get(line.eventId);
            const title = event
              ? `${event.discipline} ${messages.events.gender[event.gender].toLowerCase()}`
              : "";
            return (
              <li key={line.eventId}>
                <Link
                  href={event ? `/epreuves/${event.slug}` : "/epreuves"}
                  className="flex flex-col gap-2 rounded-card border border-border bg-card p-3.5"
                >
                  <span className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 break-words font-extrabold">{title}</span>
                    <span
                      className={
                        line.points > 0
                          ? "text-xl font-extrabold text-success-text"
                          : "text-xl font-extrabold text-muted-foreground"
                      }
                    >
                      {messages.points.line(line.points)}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {pointsReasonLabels(line.reasons).map((label) => (
                      <span
                        key={label.text}
                        className={
                          label.joker
                            ? "rounded-full bg-secondary/50 px-2.5 py-0.5 text-xs font-bold"
                            : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold"
                        }
                      >
                        {label.text}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
        {messages.points.note}
      </p>
    </>
  );
}
