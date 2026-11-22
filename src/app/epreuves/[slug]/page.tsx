import Link from "next/link";

import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import { getEventOdds } from "@/application/set-event-odds";
import { listMyLeagues, type League } from "@/application/leagues";
import { listPredictionLeagues, type PredictionLeague } from "@/application/prediction-leagues";
import { getMyPrediction, type Prediction } from "@/application/save-prediction";
import { Animal } from "@/components/band/animal";
import { CountryFlag } from "@/components/athletes/country-flag";
import { buttonVariants } from "@/components/ui/button";
import { LockBanner } from "@/components/countdown/lock-banner";
import { ErrorNotice } from "@/components/error-notice";
import { REVEAL_ANCHOR } from "@/components/community/trend-card";
import { AddToMyLeagueForm } from "@/components/leagues/league-forms";
import { PredictionLeaguesBlock } from "@/components/leagues/prediction-leagues";
import { PodiumMedals } from "@/components/podium/podium-medals";
import { PodiumPicker, type PickerAthlete } from "@/components/podium/podium-picker";
import { animalOrHare } from "@/domain/band";
import { competitionDay, TIME_ZONE } from "@/domain/competition";
import { eventPhase } from "@/domain/countdown";
import type { EventDetail } from "@/domain/event";
import { formatMark, tidyMark } from "@/domain/discipline";
import { pickChoices } from "@/domain/odds";
import { sortStartList } from "@/domain/start-list";
import { canPredictRound } from "@/domain/rounds";
import { draftFromPodium, emptyDraft } from "@/domain/podium-draft";
import { athleteHref } from "@/domain/redirect";
import {
  createPublicSupabaseClient,
  createSupabaseLeagueRepository,
  createSupabaseOddsRepository,
  createSupabasePredictionLeagueRepository,
  createSupabasePredictionRepository,
  type CurrentUser,
} from "@/infra";

import { currentCompetition } from "../../competition";
import { messages } from "../../messages.fr";
import { loadScale } from "../../scale";
import { getCurrentUser, getSessionClient } from "../../session";
import { savePredictionLeaguesAction } from "./actions";
import { ChallengeSection } from "./challenge-section";
import { ForgetPodium } from "./forget-podium";
import { PredictionForm } from "./prediction-form";
import { ResultSection } from "./result-section";
import { RevealHidden, RevealSection } from "./reveal-section";
import { publicEventReader, publicRanking } from "../../public-data";

async function loadEvent(slug: string): Promise<EventDetail | "error"> {
  try {
    const events = publicEventReader();
    // Event slugs are unique: the event opens whatever its competition.
    return await getEvent({ events }).execute({ competitionSlug: null, eventSlug: slug });
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "EVENT_NOT_FOUND") notFound();
      return "error";
    }
    throw error;
  }
}

/**
 * What the picker offers: the start list, or with odds the proposed athletes and « autre
 * athlète »; null while the odds of a competition that plays with them are not set.
 */
async function loadChoices(event: EventDetail): Promise<PickerAthlete[] | null> {
  if (!event.oddsRequired) return event.entries;
  try {
    const odds = createSupabaseOddsRepository(createPublicSupabaseClient());
    const found = await getEventOdds({ odds }).execute({ eventId: event.id });
    if (!found.odds) return null;
    const unit = event.markUnit;
    const tidy = (mark: string | null) => (mark && unit ? tidyMark(mark, unit) : mark);
    const marks = new Map(
      [...found.marks].map(([id, m]) => [id, { pr: tidy(m.pr), sb: tidy(m.sb) }] as const),
    );
    return pickChoices(event.entries, found.odds, marks, messages.picker.other);
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

/** The player's prediction, null when none, "error" when it cannot be read. */
async function loadMyPrediction(
  userId: string,
  eventId: string,
): Promise<Prediction | null | "error"> {
  try {
    const predictions = createSupabasePredictionRepository(await getSessionClient());
    return await getMyPrediction({ predictions }).execute({ userId, eventId });
  } catch (error) {
    if (error instanceof UseCaseError) return "error";
    throw error;
  }
}

/** The player's leagues; "error" when they cannot be read. */
async function loadMyLeagues(): Promise<League[] | "error"> {
  try {
    const leagues = createSupabaseLeagueRepository(await getSessionClient());
    return await listMyLeagues({ leagues }).execute();
  } catch (error) {
    if (error instanceof UseCaseError) return "error";
    throw error;
  }
}

/**
 * The player's leagues counting the competition, with whether the podium counts there (#1068);
 * null when they cannot be read: the podium still counts in the general ranking.
 */
async function loadPredictionLeagues(
  userId: string,
  competitionSlug: string,
  eventId: string,
  hasPrediction: boolean,
): Promise<PredictionLeague[] | null> {
  try {
    const client = await getSessionClient();
    return await listPredictionLeagues({
      leagues: createSupabaseLeagueRepository(client),
      predictionLeagues: createSupabasePredictionLeagueRepository(client),
      ranking: publicRanking(),
    }).execute({ userId, competitionSlug, eventId, hasPrediction });
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

/** « samedi 23 novembre à 19:00 », Paris time: the start of the event, its lock. */
const parisDateTime = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
/** Until when the leagues of a podium change (#1068). */
const lockLabel = (lockAt: string) => parisDateTime.format(new Date(lockAt));

/**
 * A suggestion under the podium for a player in no league of the competition (#375): create a
 * private or public one, join a public one, or add the competition to a league he created.
 * Predicting never waits for it.
 */
function LeagueSuggestion({
  competitionSlug,
  competitionName,
  owned,
  back,
}: {
  competitionSlug: string;
  competitionName: string;
  owned: League[];
  back: string;
}) {
  return (
    <section
      aria-labelledby="league-suggestion"
      className="mx-4 flex flex-col gap-3 rounded-card bg-brand-soft p-4 text-brand-ink"
    >
      <h2 id="league-suggestion" className="font-display text-xl font-extrabold">
        {messages.prediction.leagueTitle}
      </h2>
      <p className="text-sm leading-relaxed">{messages.prediction.leagueText(competitionName)}</p>
      <div className="grid gap-2">
        <Link href={`/ligues/creer?competition=${competitionSlug}`} className={buttonVariants()}>
          {messages.prediction.leagueCreate}
        </Link>
        <Link
          href={`/ligues/creer?competition=${competitionSlug}&publique=1`}
          className={buttonVariants({ variant: "outline" })}
        >
          {messages.prediction.leagueCreatePublic}
        </Link>
      </div>
      {owned.map((league) => (
        <AddToMyLeagueForm
          key={league.id}
          leagueId={league.id}
          leagueName={league.name}
          competitionSlug={competitionSlug}
          back={back}
        />
      ))}
      <Link href="/ligues" className={`${buttonVariants({ variant: "outline" })} w-full`}>
        {messages.prediction.leagueJoin}
      </Link>
    </section>
  );
}

async function PredictionSection({
  event,
  slug,
  user,
  open,
  choices,
  competitionSlug,
  competitionName,
  leagues,
  mine,
  predictionLeagues,
}: {
  event: EventDetail;
  slug: string;
  user: CurrentUser | null;
  open: boolean;
  choices: PickerAthlete[] | null;
  competitionSlug: string;
  competitionName: string;
  /** The player's leagues (read for an open event only), or "error". */
  leagues: League[] | "error";
  /** The player's prediction (read with the leagues), null when none, "error" when unreadable. */
  mine: Prediction | null | "error";
  /** The player's leagues counting the competition (#1068); null when unreadable. */
  predictionLeagues: PredictionLeague[] | null;
}) {
  const back = `/epreuves/${slug}`;

  // A final opens once its semi-finals are run: the start list is only known then.
  if (open && !canPredictRound(event.round, event.previousRounds)) {
    return <p className="mx-4 rounded-card bg-muted p-4">{messages.errors.ROUND_NOT_READY}</p>;
  }
  if (!choices) {
    return open ? (
      <p className="mx-4 rounded-card bg-muted p-4">{messages.errors.ODDS_NOT_READY}</p>
    ) : null;
  }

  if (!user) {
    return (
      <div className="mx-4 flex flex-col gap-3 rounded-card bg-muted p-4">
        <p>
          <strong className="block">{messages.prediction.visitorTitle}</strong>
          {messages.prediction.visitorText}
        </p>
        <Link
          href={`/connexion?next=${encodeURIComponent(back)}`}
          className={`${buttonVariants()} w-full`}
        >
          {messages.prediction.signIn}
        </Link>
      </div>
    );
  }

  if (mine === "error") return <ErrorNotice retryHref={back} />;
  // Leagues that cannot be read only hide the suggestion: predicting never waits for them.
  const suggestion =
    open &&
    leagues !== "error" &&
    !leagues.some((l) => l.competitionSlugs.includes(competitionSlug)) ? (
      <LeagueSuggestion
        competitionSlug={competitionSlug}
        competitionName={competitionName}
        owned={leagues.filter((l) => l.ownerId === user.userId)}
        back={back}
      />
    ) : null;
  const draft = mine ? draftFromPodium(mine.podium) : emptyDraft();
  const unit = event.markUnit;
  const markText = (value: number | null | undefined) =>
    value != null && unit ? formatMark(value, unit) : "";
  const marks = {
    first: markText(mine?.marks?.first),
    second: markText(mine?.marks?.second),
    third: markText(mine?.marks?.third),
  };

  if (open) {
    const scale = await loadScale();
    return (
      <div className="flex flex-col gap-5">
        <PredictionForm
          eventId={event.id}
          slug={slug}
          athletes={choices}
          initial={{ draft, marks }}
          markUnit={event.markUnit}
          markFamily={event.markFamily}
          discipline={event.discipline}
          tolerance={event.tolerance}
          scale={scale}
          leagues={
            predictionLeagues && {
              list: predictionLeagues,
              lockLabel: lockLabel(event.lockAt),
              save: savePredictionLeaguesAction.bind(null, slug, event.id),
            }
          }
        />
        {suggestion}
      </div>
    );
  }
  if (!mine) {
    return (
      <p className="mx-4 rounded-2xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">
        {messages.prediction.none}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <PodiumPicker athletes={choices} initialDraft={draft} disabled />
      {mine.marks && (
        <dl className="mx-4 flex flex-col gap-1 rounded-2xl bg-muted px-3.5 py-3 text-sm">
          {(["first", "second", "third"] as const).map((slot) => {
            const name = choices.find((c) => c.athleteId === mine.podium[slot])?.name;
            return marks[slot] && name ? (
              <div key={slot} className="flex justify-between gap-3">
                <dt>{messages.picker.markLabel(name)}</dt>
                <dd className="font-mono font-bold">{marks[slot]}</dd>
              </div>
            ) : null;
          })}
        </dl>
      )}
      {predictionLeagues && predictionLeagues.length > 0 && (
        <PredictionLeaguesBlock
          leagues={predictionLeagues}
          locked
          lockLabel={lockLabel(event.lockAt)}
        />
      )}
    </div>
  );
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ligue?: string | string[] }>;
}) {
  const { slug } = await params;
  const { ligue } = await searchParams;
  const requestedLeague = typeof ligue === "string" && ligue !== "" ? ligue : undefined;
  // The player is read while the event is.
  const [loaded, user] = await Promise.all([loadEvent(slug), getCurrentUser()]);

  if (loaded === "error") {
    return (
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <ErrorNotice retryHref={`/epreuves/${slug}`} />
      </main>
    );
  }

  const event = loaded;
  const winner = event.results.find((result) => result.rank === 1);
  // Times and points follow the event's own competition.
  const [competition, choices] = await Promise.all([
    currentCompetition(event.competitionSlug),
    loadChoices(event),
  ]);
  const open = eventPhase(new Date(), event.lockAt) === "open";
  // The picker already lists the athletes of an open event for a signed-in player. Their leagues,
  // and prediction do not depend on one another: read together.
  const readsPrediction =
    !!choices && !(open && !canPredictRound(event.round, event.previousRounds));
  const [leagues, mine] = await Promise.all([
    user && open ? loadMyLeagues() : [],
    user && readsPrediction && !winner ? loadMyPrediction(user.userId, event.id) : null,
  ]);
  // Where the podium counts (#1068): offered while open, told once locked.
  const predictionLeagues =
    user && readsPrediction && !winner && mine !== "error" && (open || mine)
      ? await loadPredictionLeagues(user.userId, competition.slug, event.id, !!mine)
      : null;
  const showStartList = !(user && open);
  const when = parisDateTime.format(new Date(event.startsAt));
  const markOf = new Map(event.results.map((result) => [result.athleteId, result.mark]));
  const startList = sortStartList(event.entries, event.markUnit);
  const bySeasonBest = !!event.markUnit && startList.some((entry) => entry.seasonBest);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <header className="px-4 pt-4">
        <div className="mx-auto flex max-w-md flex-col gap-3 lg:max-w-5xl">
          <Link
            href={`/competitions?competition=${competition.slug}&jour=${competitionDay(event.startsAt)}`}
            className="inline-flex min-h-11 items-center self-start font-semibold text-brand dark:text-secondary"
          >
            ‹ {messages.event.back}
          </Link>
          <div className="flex items-start gap-3">
            {/* The animal of its family (#800), the hare for a relay; decorative. */}
            <Animal kind={animalOrHare(event.markFamily)} className="mt-1" />
            <div className="min-w-0">
              {winner && (
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {messages.result.eyebrow(messages.events.name(event.discipline, event.gender))}
                </p>
              )}
              <h1 className="break-words font-display text-3xl font-extrabold leading-tight">
                {winner
                  ? messages.result.winner(winner.name)
                  : messages.event.title(event.discipline)}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.events.gender[event.gender]} ·{" "}
                <span className="first-letter:uppercase">{when.replace(" à ", " · ")}</span>
              </p>
            </div>
          </div>
          {event.status === "upcoming" ? (
            <LockBanner lockAt={event.lockAt} />
          ) : (
            <span className="self-start rounded-full bg-muted px-3 py-1 text-xs font-bold">
              {messages.events.status[event.status]}
            </span>
          )}
          {event.subDisciplines.length > 0 && (
            <section aria-labelledby="combined-title" className="flex flex-col gap-2">
              <h2
                id="combined-title"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                {messages.event.combined(event.subDisciplines.length)}
              </h2>
              <ol className="flex flex-wrap gap-1.5">
                {event.subDisciplines.map((discipline, index) => (
                  <li
                    key={`${index}-${discipline}`}
                    className="rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>{" "}
                    {discipline}
                  </li>
                ))}
              </ol>
              <p className="text-sm text-muted-foreground">{messages.event.combinedNote}</p>
            </section>
          )}
          {event.results.length > 0 && (
            <div className="rounded-card border border-border bg-card p-4 lg:max-w-md">
              <PodiumMedals results={event.results} />
            </div>
          )}
        </div>
      </header>

      {/* From 1024 px (#990) the start list stands beside the podium; below, it comes after. */}
      <div className="mx-auto w-full max-w-md lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col">
          {event.previousRounds.length > 0 && (
            <details className="mx-auto mt-4 w-full max-w-md px-4">
              <summary className="flex min-h-11 cursor-pointer items-center font-bold">
                {messages.rounds.previous(event.previousRounds.length)}
              </summary>
              <div className="mt-2 flex flex-col gap-4">
                {event.previousRounds.map((round, index) => (
                  <section
                    key={round.slug}
                    aria-label={messages.rounds.label(round.round, index + 1)}
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {messages.rounds.label(round.round, index + 1)} ·{" "}
                      {messages.events.status[round.status]}
                    </h3>
                    {round.results.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {messages.rounds.noResult}
                      </p>
                    ) : (
                      <ol className="mt-1 flex flex-col">
                        {round.results.map((r) => (
                          <li
                            key={r.athleteId}
                            className="flex min-h-11 items-center gap-3 border-b border-border py-1.5"
                          >
                            <span className="w-6 shrink-0 text-center font-mono text-sm text-muted-foreground">
                              {r.rank}
                            </span>
                            <span aria-hidden="true">
                              <CountryFlag code={r.countryCode} />
                            </span>
                            <Link
                              href={athleteHref(r.slug, `/epreuves/${slug}`)}
                              className="min-w-0 flex-1 break-words font-semibold"
                            >
                              {r.name}
                            </Link>
                            <span className="font-mono text-sm font-semibold tabular-nums">
                              {r.mark ?? ""}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                ))}
              </div>
            </details>
          )}

          <section className="mx-auto w-full max-w-md pt-6" aria-label={messages.picker.podium}>
            {user && !open && <ForgetPodium eventId={event.id} />}
            {user && winner ? (
              <ResultSection event={event} slug={slug} user={user} />
            ) : (
              <PredictionSection
                event={event}
                slug={slug}
                user={user}
                open={open}
                choices={choices}
                competitionSlug={competition.slug}
                competitionName={competition.name}
                leagues={leagues}
                mine={mine}
                predictionLeagues={predictionLeagues}
              />
            )}
          </section>

          {user && (
            <div className="mx-auto w-full max-w-md pt-6 empty:hidden">
              <ChallengeSection event={event} slug={slug} user={user} />
            </div>
          )}

          {user && (
            <section id={REVEAL_ANCHOR} className="mx-auto w-full max-w-md scroll-mt-4 pt-6">
              {open ? (
                <RevealHidden />
              ) : (
                <RevealSection event={event} slug={slug} user={user} ligue={requestedLeague} />
              )}
            </section>
          )}
        </div>
        {showStartList && (
          <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-3 px-4 py-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {messages.event.startList}
              </h2>
              {bySeasonBest && (
                <p className="text-xs text-muted-foreground">{messages.event.startListOrder}</p>
              )}
            </div>
            {startList.length === 0 ? (
              <p className="rounded-card bg-muted p-4">{messages.event.startListEmpty}</p>
            ) : (
              <ul aria-label={messages.event.startList} className="flex flex-col gap-2">
                {startList.map((entry) => (
                  <li
                    key={entry.athleteId}
                    className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2"
                  >
                    <span
                      aria-hidden="true"
                      className="w-7 shrink-0 text-center text-xl leading-none"
                    >
                      <CountryFlag code={entry.countryCode} />
                    </span>
                    <Link
                      href={athleteHref(entry.slug, `/epreuves/${slug}`)}
                      className="min-w-0 flex-1 break-words font-bold underline-offset-2 hover:underline"
                    >
                      {entry.name}
                    </Link>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {markOf.get(entry.athleteId) ?? entry.seasonBest ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
