import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import { getLeagueEventResult } from "@/application/league-event-result";
import { getLeague } from "@/application/leagues";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { PodiumMedals } from "@/components/podium/podium-medals";
import { OTHER_ATHLETE } from "@/domain/podium-draft";
import { createSupabaseRevealRepository } from "@/infra";

import { messages } from "../../../../messages.fr";
import { breakdownRules } from "../../../../points-labels";
import { publicEventReader } from "../../../../public-data";
import { loadScale } from "../../../../scale";
import { ScoredPredictionList } from "../../../../scored-predictions";
import { getSessionClient } from "../../../../session";
import { leaguePorts, loadLeagueEvents } from "../../../data";

const text = messages.leagueResult;

async function load(
  leagueId: string,
  slug: string,
  ports: Awaited<ReturnType<typeof leaguePorts>>,
) {
  try {
    const [found, event] = await Promise.all([
      getLeague(ports).execute({ leagueId }),
      getEvent({ events: publicEventReader() }).execute({ competitionSlug: null, eventSlug: slug }),
    ]);
    const { league } = found;
    // Only an event of the league's competitions has a result in it.
    if (!league.competitionSlugs.includes(event.competitionSlug ?? "")) notFound();
    const families = league.families ?? [];
    const counts =
      families.length === 0 ||
      (await loadLeagueEvents({ competitionSlugs: league.competitionSlugs, families })).some(
        (e) => e.id === event.id && e.counts,
      );
    const [result, scale] = await Promise.all([
      getLeagueEventResult({
        reveal: createSupabaseRevealRepository(await getSessionClient()),
        leagues: ports.leagues,
        jokers: ports.jokers,
      }).execute({ leagueId, eventId: event.id }),
      loadScale(),
    ]);
    return { league, members: found.members, event, counts, result, scale };
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "LEAGUE_NOT_FOUND" || error.code === "EVENT_NOT_FOUND") notFound();
      // Before the lock, nothing of the others is shown: the event itself says so.
      if (error.code === "EVENT_NOT_LOCKED") redirect(`/epreuves/${slug}`);
      return "error" as const;
    }
    throw error;
  }
}

/**
 * The result of a final inside a league (#1155), without leaving it: the official podium, then
 * every member's prediction ranked by points in the league, each unfolding the detail of its
 * points, the members without a prediction last.
 */
export default async function LeagueEventResultPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ports = await leaguePorts(`/ligues/${id}/epreuves/${slug}`);
  const loaded = await load(id, slug, ports);
  if (loaded === "error") {
    return (
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <ErrorNotice
          retryHref={`/ligues/${id}/epreuves/${slug}`}
          message={messages.errors.REVEAL_UNAVAILABLE}
        />
      </main>
    );
  }
  const { league, members, event, counts, result, scale } = loaded;
  const eventName = messages.events.name(event.discipline, event.gender);
  const names = new Map(event.entries.map((entry) => [entry.athleteId, entry.name]));
  names.set(OTHER_ATHLETE, messages.picker.other);
  const nameOf = (athleteId: string) => names.get(athleteId) ?? "?";
  const hasResult = event.results.length > 0;

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={eventName}
        subtitle={text.kicker(messages.leagues.eventDay(event.startsAt))}
        back={{ href: `/ligues/${id}`, label: league.name }}
        icon="🏁"
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        {!counts && (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            {text.notCounted}
          </p>
        )}
        {hasResult ? (
          <section
            aria-label={text.official}
            className="rounded-card border border-border bg-card p-4"
          >
            <PodiumMedals results={event.results} />
          </section>
        ) : (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.noResult}</p>
        )}
        <ul
          aria-label={messages.breakdown.legend}
          className="flex flex-wrap gap-1.5 text-xs font-semibold"
        >
          {(["exact", "on_podium", "off"] as const).map((outcome) => (
            <li key={outcome} className="rounded-full bg-muted px-2.5 py-1">
              <span aria-hidden="true">{messages.breakdown.outcome[outcome]}</span>{" "}
              {messages.breakdown.outcomeLabel[outcome]}
            </li>
          ))}
        </ul>
        <section aria-labelledby="league-result-list" className="flex flex-col gap-2">
          <h2
            id="league-result-list"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            {text.listTitle(result.lines.length, members.length)}
          </h2>
          <ScoredPredictionList
            lines={result.lines}
            without={result.without}
            official={event.results}
            nameOf={nameOf}
            rules={breakdownRules(scale)}
            meId={ports.userId}
            group="league-result"
          />
        </section>
        <Link
          href={`/epreuves/${slug}?ligue=tous`}
          className="flex min-h-13 flex-col justify-center rounded-card border border-border bg-card px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-bold">{text.allPlayers}</span>
          <span className="text-sm text-muted-foreground">{text.allPlayersText}</span>
        </Link>
      </div>
    </main>
  );
}
