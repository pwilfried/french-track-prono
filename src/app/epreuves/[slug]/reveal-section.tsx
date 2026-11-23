import Link from "next/link";

import { getEventConsensus, type EventConsensus } from "@/application/consensus";
import { UseCaseError } from "@/application/errors";
import { rankLeaguePredictions } from "@/application/league-event-result";
import { listMyLeagues, type League } from "@/application/leagues";
import {
  ALL_PLAYERS,
  listEventPredictions,
  revealFilter,
  type EventReveal,
  type RevealedPrediction,
} from "@/application/reveal";
import { buttonVariants } from "@/components/ui/button";
import { ErrorNotice } from "@/components/error-notice";
import { ReactionBar, ReactionSummary } from "@/components/reveal/reaction-bar";
import { ConsensusBlock } from "@/components/reveal/consensus-block";
import { PointsStats } from "@/components/reveal/points-stats";
import { RevealedPredictionCard } from "@/components/reveal/revealed-prediction-card";
import type { EventDetail } from "@/domain/event";
import { eventPointsStats, type BreakdownRules } from "@/domain/event-result";
import { OTHER_ATHLETE } from "@/domain/podium-draft";
import { reactionCounts, type Reaction } from "@/domain/reveal";
import type { PredictionJoker } from "@/domain/league-jokers";
import {
  createSupabaseConsensusRepository,
  createSupabaseLeagueJokerRepository,
  createSupabaseLeagueRepository,
  createSupabaseRevealRepository,
  type CurrentUser,
} from "@/infra";

import { messages } from "../../messages.fr";
import { breakdownRules } from "../../points-labels";
import { loadScale } from "../../scale";
import { ScoredPredictionList } from "../../scored-predictions";
import { getSessionClient } from "../../session";

import { reactAction } from "./react-action";

async function load(
  event: EventDetail,
  requested: string | undefined,
): Promise<
  | (EventReveal &
      EventConsensus & {
        leagues: League[];
        leagueId?: string;
        /** The joker each member played on the event in the league shown (#1090). */
        jokers: Map<string, PredictionJoker>;
        /** The scale, for the detail of the points once the result is in (#1155). */
        rules: BreakdownRules | null;
      })
  | "error"
> {
  try {
    const client = await getSessionClient();
    const leagueRepository = createSupabaseLeagueRepository(client);
    const leagues = await listMyLeagues({ leagues: leagueRepository }).execute();
    const leagueIds = leagues.map((league) => league.id);
    const leagueId = revealFilter(requested, leagueIds);
    const [reveal, consensus, plays, scale] = await Promise.all([
      listEventPredictions({
        reveal: createSupabaseRevealRepository(client),
        leagues: leagueRepository,
      }).execute({ eventId: event.id, leagueId }),
      getEventConsensus({
        consensus: createSupabaseConsensusRepository(client),
      }).execute({
        eventId: event.id,
        leagueId,
        leagueIds,
        official: event.results,
      }),
      leagueId ? createSupabaseLeagueJokerRepository(client).plays(leagueId) : [],
      event.results.length > 0 ? loadScale() : null,
    ]);
    const jokers = new Map(
      plays.filter((p) => p.eventId === event.id).map((p) => [p.userId, p.joker] as const),
    );
    return {
      ...reveal,
      ...consensus,
      leagues,
      leagueId,
      jokers,
      rules: scale && breakdownRules(scale),
    };
  } catch (error) {
    if (error instanceof UseCaseError) return "error";
    throw error;
  }
}

/**
 * Once the event is locked: what the players predicted (#680), with a filter on each of my leagues,
 * opened on my first league (#984). A league shows its members' podiums, ranked by points with
 * their detail once the result is in (#1155). « Tous » shows only stats, never the list of
 * podiums: once the result is in, the spread of the points, my rank and the 3 best predictions.
 * `ligue`: the filter asked in the URL, a league id or « tous ».
 */
export async function RevealSection({
  event,
  slug,
  user,
  ligue,
}: {
  event: EventDetail;
  slug: string;
  user: CurrentUser;
  ligue?: string;
}) {
  const base = `/epreuves/${slug}`;
  const loaded = await load(event, ligue);
  if (loaded === "error") {
    return (
      <div className="mx-4">
        <ErrorNotice
          retryHref={ligue ? `${base}?ligue=${ligue}` : base}
          message={messages.errors.REVEAL_UNAVAILABLE}
        />
      </div>
    );
  }

  const { predictions, consensus, counts, leagues, leagueId, jokers, rules } = loaded;
  const names = new Map(event.entries.map((entry) => [entry.athleteId, entry.name]));
  names.set(OTHER_ATHLETE, messages.picker.other);
  const nameOf = (athleteId: string) => names.get(athleteId) ?? "?";
  const tabs = [
    {
      href: `${base}?ligue=${ALL_PLAYERS}`,
      label: messages.reveal.all,
      count: counts.all,
      current: !leagueId,
    },
    ...leagues.map((league) => ({
      href: `${base}?ligue=${league.id}`,
      label: league.name,
      count: counts.leagues[league.id] ?? 0,
      current: league.id === leagueId,
    })),
  ];
  const scored = rules ? predictions.filter((p) => p.score) : [];

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
                  <span className="shrink-0 whitespace-pre font-mono tabular-nums">
                    {messages.reveal.tabCount(tab.count)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {!leagueId && scored.length > 0 && (
        <PointsStats
          stats={eventPointsStats(
            scored.map((p) => ({
              userId: p.userId,
              points: p.score!.points,
              perfect: p.score!.reasons.some((r) => r.kind === "perfect_podium"),
            })),
            user.userId,
          )}
        />
      )}
      {consensus.total > 0 && (
        <ConsensusBlock consensus={consensus} nameOf={nameOf} official={event.results} />
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
          <Link href="/competitions" className={`${buttonVariants()} mt-2`}>
            {messages.reveal.seeEvents}
          </Link>
        </div>
      ) : !leagueId ? (
        <>
          {rules && scored.length > 0 && (
            <section className="mx-4 flex flex-col gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {messages.pointsStats.topTitle}
              </h3>
              <ScoredPredictionList
                lines={rankLeaguePredictions(scored, new Map()).slice(0, 3)}
                official={event.results}
                nameOf={nameOf}
                rules={rules}
                meId={user.userId}
                group="top"
              />
            </section>
          )}
          <p className="mx-4 rounded-card bg-muted p-4 text-sm text-muted-foreground">
            {leagues.length > 0
              ? messages.pointsStats.leaguesHint
              : messages.pointsStats.noLeagueHint}
          </p>
        </>
      ) : rules ? (
        <div className="mx-4">
          <ScoredPredictionList
            lines={rankLeaguePredictions(predictions, jokers)}
            official={event.results}
            nameOf={nameOf}
            rules={rules}
            meId={user.userId}
            group={`ligue-${leagueId}`}
            extra={(line) => <Reactions prediction={line} slug={slug} user={user} />}
          />
        </div>
      ) : (
        <PredictionList
          predictions={predictions}
          slug={slug}
          user={user}
          nameOf={nameOf}
          jokers={jokers}
        />
      )}
    </div>
  );
}

/** The reactions of a revealed podium (mine: only the counts). */
function Reactions({
  prediction,
  slug,
  user,
}: {
  prediction: RevealedPrediction;
  slug: string;
  user: CurrentUser;
}) {
  const counts = reactionCounts(prediction.reactions.map((r) => r.reaction));
  if (prediction.userId === user.userId) return <ReactionSummary counts={counts} />;
  const mine: Reaction | null =
    prediction.reactions.find((r) => r.userId === user.userId)?.reaction ?? null;
  return (
    <ReactionBar
      slug={slug}
      predictionId={prediction.predictionId}
      pseudo={prediction.pseudo}
      counts={Object.fromEntries(counts.map((c) => [c.reaction, c.count]))}
      mine={mine}
      react={reactAction}
    />
  );
}

/** The revealed podiums of a league before the result, each with its reactions. */
function PredictionList({
  predictions,
  slug,
  user,
  nameOf,
  jokers,
}: {
  predictions: RevealedPrediction[];
  slug: string;
  user: CurrentUser;
  nameOf: (athleteId: string) => string;
  jokers: Map<string, PredictionJoker>;
}) {
  return (
    <ul className="mx-4 flex flex-col gap-2.5">
      {predictions.map((prediction) => {
        const joker = jokers.get(prediction.userId);
        return (
          <RevealedPredictionCard
            key={prediction.predictionId}
            pseudo={prediction.pseudo}
            bib={prediction.bib}
            podium={prediction.podium}
            joker={joker ? messages.leagueJokers.name[joker] : null}
            mine={prediction.userId === user.userId}
            flair={prediction.score?.reasons.some((r) => r.kind === "flair") ?? false}
            nameOf={nameOf}
          >
            <Reactions prediction={prediction} slug={slug} user={user} />
          </RevealedPredictionCard>
        );
      })}
    </ul>
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
