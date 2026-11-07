import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import { listMyLeagues, type League } from "@/application/leagues";
import { listEventPredictions, type RevealedPrediction } from "@/application/reveal";
import { buttonVariants } from "@/components/ui/button";
import { ErrorNotice } from "@/components/error-notice";
import { RevealedPredictionCard } from "@/components/reveal/revealed-prediction-card";
import type { EventDetail } from "@/domain/event";
import {
  createSupabaseLeagueRepository,
  createSupabaseRevealRepository,
  type CurrentUser,
} from "@/infra";

import { messages } from "../../messages.fr";
import { getSessionClient } from "../../session";

async function load(
  eventId: string,
  leagueId: string | undefined,
): Promise<{ predictions: RevealedPrediction[]; leagues: League[] } | "error"> {
  try {
    const client = await getSessionClient();
    const leagueRepository = createSupabaseLeagueRepository(client);
    const [predictions, leagues] = await Promise.all([
      listEventPredictions({
        reveal: createSupabaseRevealRepository(client),
        leagues: leagueRepository,
      }).execute({ eventId, leagueId }),
      listMyLeagues({ leagues: leagueRepository }).execute(),
    ]);
    return { predictions, leagues };
  } catch (error) {
    if (error instanceof UseCaseError) return "error";
    throw error;
  }
}

/** Everyone's podium once the event is locked, with a filter on each of my leagues. */
export async function RevealSection({
  event,
  slug,
  user,
  leagueId,
}: {
  event: EventDetail;
  slug: string;
  user: CurrentUser;
  leagueId?: string;
}) {
  const base = `/epreuves/${slug}`;
  const loaded = await load(event.id, leagueId);
  if (loaded === "error") {
    return (
      <div className="mx-4">
        <ErrorNotice
          retryHref={leagueId ? `${base}?ligue=${leagueId}` : base}
          message={messages.errors.REVEAL_UNAVAILABLE}
        />
      </div>
    );
  }

  const { predictions, leagues } = loaded;
  const names = new Map(event.entries.map((entry) => [entry.athleteId, entry.name]));
  const nameOf = (athleteId: string) => names.get(athleteId) ?? "?";
  const tabs = [
    { href: base, label: messages.reveal.all, current: !leagueId },
    ...leagues.map((league) => ({
      href: `${base}?ligue=${league.id}`,
      label: league.name,
      current: league.id === leagueId,
    })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="mx-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {messages.reveal.title}
        </h2>
        <span className="text-sm text-muted-foreground">
          {messages.reveal.count(predictions.length)}
        </span>
      </div>
      {leagues.length > 0 && (
        <nav aria-label={messages.reveal.filtersLabel} className="overflow-x-auto px-4">
          <ul className="flex gap-2">
            {tabs.map((tab) => (
              <li key={tab.href} className="shrink-0">
                <Link
                  href={tab.href}
                  scroll={false}
                  aria-current={tab.current ? "page" : undefined}
                  className={`flex min-h-11 max-w-56 items-center rounded-full border px-4 text-sm font-semibold ${
                    tab.current
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card"
                  }`}
                >
                  <span className="truncate">{tab.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {predictions.length === 0 ? (
        <div className="mx-4 flex flex-col items-center gap-2 rounded-card bg-muted p-6 text-center">
          <span aria-hidden="true" className="text-4xl">
            🦗
          </span>
          <p className="font-bold">
            {leagueId ? messages.reveal.emptyLeague : messages.reveal.emptyAll}
          </p>
          <p className="text-sm text-muted-foreground">{messages.reveal.emptyText}</p>
          <Link href="/epreuves" className={`${buttonVariants()} mt-2`}>
            {messages.reveal.seeEvents}
          </Link>
        </div>
      ) : (
        <ul className="mx-4 flex flex-col gap-2.5">
          {predictions.map((prediction) => (
            <RevealedPredictionCard
              key={prediction.predictionId}
              pseudo={prediction.pseudo}
              avatar={prediction.avatar}
              podium={prediction.podium}
              useJoker={prediction.useJoker}
              mine={prediction.userId === user.userId}
              nameOf={nameOf}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Before the lock: a reminder that the others' podiums stay hidden until then. */
export function RevealHidden() {
  return (
    <div className="mx-4 rounded-card border-2 border-dashed border-border p-5 text-center text-muted-foreground">
      <span aria-hidden="true">🙈</span>
      <p className="font-bold">{messages.reveal.hiddenTitle}</p>
      <p className="text-sm">{messages.reveal.hiddenText}</p>
    </div>
  );
}
