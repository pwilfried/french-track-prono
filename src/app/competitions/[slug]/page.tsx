import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { listEvents } from "@/application/list-events";
import { listMyPredictions } from "@/application/list-my-predictions";
import { getGeneralRanking } from "@/application/rankings";
import { EventCard, type MyEventState } from "@/components/events/event-card";
import { VenueChip } from "@/components/events/venue-chip";
import { LockCountdown } from "@/components/home/lock-countdown";
import { buttonVariants } from "@/components/ui/button";
import type { EventSummary } from "@/domain/event";
import { openEvents } from "@/domain/event-list";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePredictionRepository,
  createSupabaseRankingRepository,
} from "@/infra";

import { loadCompetitions, type ShownCompetition } from "../../competition";
import { messages } from "../../messages.fr";
import { getCurrentUser, getSessionClient } from "../../session";

async function loadEvents(competitionSlug: string): Promise<EventSummary[]> {
  try {
    const events = createSupabaseEventReader(createPublicSupabaseClient());
    return await listEvents({ events }).execute({ competitionSlug });
  } catch (error) {
    if (error instanceof UseCaseError) return [];
    throw error;
  }
}

/** The player's rank and predictions; null for a visitor or when they cannot be read. */
async function loadPlayer(userId: string, competitionSlug: string) {
  try {
    const client = await getSessionClient();
    const [ranking, mine] = await Promise.all([
      getGeneralRanking({ ranking: createSupabaseRankingRepository(client) }).execute({
        competitionSlugs: [competitionSlug],
      }),
      listMyPredictions({ predictions: createSupabasePredictionRepository(client) }).execute({
        userId,
        competitionSlug,
      }),
    ]);
    const me = ranking.find((p) => p.userId === userId);
    return {
      rank: me?.rank ?? null,
      players: ranking.length,
      mine: new Map<string, MyEventState>(
        mine.map((p) => [p.eventId, { predicted: true, joker: p.useJoker }]),
      ),
    };
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

async function findCompetition(slug: string): Promise<ShownCompetition> {
  const { coming, past } = await loadCompetitions();
  const competition = [...coming, ...past].find((c) => c.slug === slug);
  if (!competition) notFound();
  return competition;
}

/** A competition (Officiel board 01): the next lock, my rank, the next events. */
export default async function CompetitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const now = new Date();
  const [competition, events, user] = await Promise.all([
    findCompetition(slug),
    loadEvents(slug),
    getCurrentUser(),
  ]);
  const player = user ? await loadPlayer(user.userId, slug) : null;
  const eventsHref = `/competitions?competition=${slug}`;
  const next = openEvents(events, now, 3);
  const started = events.some((e) => Date.parse(e.startsAt) <= now.getTime());

  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5 md:max-w-5xl">
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[1fr_300px]">
        <section className="hero flex flex-col gap-4 rounded-card p-5 md:p-8">
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#dce6f5]">
            {started ? messages.home.current : messages.home.upcoming}
            <VenueChip venue={competition.venue} className="normal-case tracking-normal" />
          </p>
          <div>
            <h1 className="font-display text-3xl font-extrabold leading-tight md:text-5xl">
              {competition.name}
            </h1>
            <p className="mt-1 text-[#dce6f5]">{competition.place}</p>
          </div>
          {next[0] && <LockCountdown lockAt={next[0].lockAt} />}
          <div className="flex flex-wrap gap-2">
            {next[0] && (
              <Link href={`/epreuves/${next[0].slug}`} className={buttonVariants()}>
                {messages.home.compose}
              </Link>
            )}
            <Link
              href={eventsHref}
              className={`${buttonVariants({ variant: "outline" })} border-white text-white`}
            >
              {messages.home.seeAll(events.length)}
            </Link>
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          {player ? (
            <Link
              href="/classement"
              className="flex min-h-16 items-center gap-4 rounded-card border border-border bg-card p-4"
            >
              <span className="font-mono text-3xl font-bold text-brand dark:text-secondary">
                {player.rank === null ? "–" : `#${player.rank}`}
              </span>
              <span>
                <span className="block font-bold">{messages.home.myRank}</span>
                <span className="block text-sm text-muted-foreground">
                  {player.rank === null
                    ? messages.home.notRanked
                    : messages.home.players(player.players)}
                </span>
              </span>
            </Link>
          ) : (
            <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
              <p className="text-sm">{messages.app.tagline}</p>
              {!user && (
                <Link href="/connexion" className={`${buttonVariants()} w-full`}>
                  {messages.account.signIn}
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="next-events">
        <h2
          id="next-events"
          className="border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
        >
          {messages.home.nextEvents}
        </h2>
        {next.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            {messages.home.noneOpen}
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-3">
            {next.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                now={now}
                mine={
                  player
                    ? (player.mine.get(event.id) ?? { predicted: false, joker: false })
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
