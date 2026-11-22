import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getManagerFeed } from "@/application/manager-feed";
import { getManagerSeason, type MySeason } from "@/application/manager-home";
import {
  getManagerLeague,
  listSeasonCompetitions,
  mercatoLaunch,
  seasonFits,
  type ManagerLeagueFile,
  type SeasonCompetition,
} from "@/application/manager-leagues";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueFeed } from "@/components/leagues/league-feed";
import { LeagueHero } from "@/components/leagues/league-hero";
import { LeagueTabs } from "@/components/leagues/league-tabs";
import { ShareInvite } from "@/components/leagues/share-invite";
import { LeagueRulesSheet } from "@/components/manager/league-rules-sheet";
import { MySeasonCard } from "@/components/manager/manager-home";
import { managerPhase } from "@/components/manager/manager-league-card";
import { Bib } from "@/components/profile/bib";
import { buttonVariants } from "@/components/ui/button";
import { utcToParis } from "@/domain/competition";
import type { FeedGroup } from "@/domain/league-moments";
import {
  PLANNED_ROUNDS,
  mercatoCalendar,
  mercatoStatus,
  playersAwaited,
  seasonFormat,
} from "@/domain/manager-league";
import { roundHours } from "@/domain/manager-round";
import {
  createSupabaseManagerFeedRepository,
  createSupabaseManagerLineups,
  createSupabaseManagerSeasonRepository,
} from "@/infra";

import { messages } from "../../messages.fr";
import { getSessionClient } from "../../session";
import { managerPorts } from "../data";
import { CompetitionsForm, LaunchMercatoForm, MercatoSettingsForm } from "../mercato-form";

const text = messages.manager;

/** « Saison », the league itself, then « Fil », its moments (#875). */
const TABS = ["saison", "fil"] as const;
/** The feed shows its 10 latest cards, then « Voir plus » (#979). */
const FEED_PAGE = 10;

/** The league's competitions, then those still available it does not have, first one first. */
function competitionChoices(league: SeasonCompetition[], available: SeasonCompetition[]) {
  const ids = new Set(league.map((c) => c.id));
  return [...league, ...available.filter((c) => !ids.has(c.id))].sort((a, b) =>
    a.firstEventAt.localeCompare(b.firstEventAt),
  );
}

/**
 * A Manager league (#419), entered from the Manager tab (#774): its phase and participants, « Ma
 * saison » with the action of the moment (#606), its competitions and its mercato (set and
 * launched by its creator, #619, #644), what is inside, its frozen rules.
 */
export default async function ManagerLeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tab = TABS.find((t) => t === query.onglet) ?? "saison";
  const ports = await managerPorts(`/manager/${id}`);
  const now = new Date();
  let league: ManagerLeagueFile | "error";
  let season: MySeason | "error" = "error";
  let feed: FeedGroup[] | "error" | null = null;
  try {
    [league, season, feed] = await Promise.all([
      getManagerLeague(ports).execute({ id }),
      leagueSeason(ports, id, now),
      // The feed is read only on its tab.
      tab === "fil" ? leagueFeed(id) : null,
    ]);
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND") notFound();
    league = "error";
  }
  if (league === "error") {
    return (
      <main id="main" className="mx-auto w-full max-w-md px-4 py-6">
        <ErrorNotice retryHref={`/manager/${id}`} message={messages.errors.LEAGUES_UNAVAILABLE} />
      </main>
    );
  }

  const count = league.participants.length;
  const { mercato, rules } = league;
  const awaited = playersAwaited(mercatoLaunch(league));
  const isOwner = league.ownerId === ports.userId;
  const open = mercato.openedAt !== null;
  const calendarStart = mercato.openedAt ?? mercato.startsAt;
  const status = mercatoStatus(mercato.openedAt, rules.rounds, now.toISOString());
  const calendar = calendarStart
    ? mercatoCalendar(calendarStart, rules.rounds, now.toISOString(), open)
    : null;
  const format = seasonFormat(league.competitions.length);
  // The creator may add competitions still available until the mercato opens.
  const available =
    isOwner && !open
      ? await listSeasonCompetitions(ports)
          .execute()
          .catch(() => [])
      : [];
  const short = !open && !seasonFits(league, new Date().toISOString());

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={league.name}
        subtitle={[
          ...(season === "error" ? [] : [managerPhase(season)]),
          text.participantsCount(count, mercato.target),
          league.isPublic ? text.publicBadge : text.privateBadge,
        ].join(" · ")}
        back={{ href: "/manager", label: text.back }}
        icon="🏟️"
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <LeagueTabs
          label={league.name}
          tabs={[
            { href: `/manager/${id}`, label: text.feed.season, active: tab === "saison" },
            {
              href: `/manager/${id}?onglet=fil`,
              label: messages.leagues.tabs.feed,
              active: tab === "fil",
            },
          ]}
        />
        {tab === "fil" ? (
          feed === "error" ? (
            <ErrorNotice
              retryHref={`/manager/${id}?onglet=fil`}
              message={messages.errors.LEAGUES_UNAVAILABLE}
            />
          ) : (
            <LeagueFeed
              groups={feed ?? []}
              pageSize={FEED_PAGE}
              empty={{
                text: text.feed.empty,
                href: `/manager/${id}/catalogue`,
                action: text.feed.toMercato,
              }}
            />
          )
        ) : (
          <>
            {season === "error" ? (
              <ErrorNotice
                retryHref={`/manager/${id}`}
                message={messages.errors.MANAGER_SEASON_UNAVAILABLE}
              />
            ) : (
              <MySeasonCard season={season} now={now} />
            )}
            <div
              role="status"
              className={`flex flex-col gap-1 rounded-2xl px-3.5 py-3 text-sm font-semibold ${open || awaited === 0 ? "bg-success/15 text-success-text" : "bg-muted text-foreground"}`}
            >
              {status.phase === "round" ? (
                <p>{text.mercatoRound(status.round, text.when(status.endsAt))}</p>
              ) : status.phase === "over" ? (
                <p>{text.mercatoOver}</p>
              ) : (
                <>
                  <p>{awaited === 0 ? text.ready : text.awaited(awaited)}</p>
                  {mercato.startsAt && (
                    <p className="font-normal">{text.opensAt(text.when(mercato.startsAt))}</p>
                  )}
                </>
              )}
            </div>

            {isOwner && !open && (
              <section aria-labelledby="mercato" className="flex flex-col gap-3">
                <h2
                  id="mercato"
                  className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {text.mercatoTitle}
                </h2>
                <p className="text-sm text-muted-foreground">{text.mercatoHint}</p>
                <CompetitionsForm
                  leagueId={league.id}
                  competitions={competitionChoices(league.competitions, available)}
                  chosen={league.competitions.map((c) => c.id)}
                />
                <MercatoSettingsForm
                  leagueId={league.id}
                  competitions={league.competitions}
                  startsAt={mercato.startsAt ? utcToParis(mercato.startsAt) : ""}
                  rounds={
                    mercato.roundMode === "custom"
                      ? {
                          mode: "custom",
                          firstHours: rules.rounds.firstHours,
                          nextHours: rules.rounds.nextHours,
                        }
                      : { mode: "auto" }
                  }
                  autoHours={rules.rounds.firstHours}
                />
                <LaunchMercatoForm leagueId={league.id} awaited={awaited} short={short} />
              </section>
            )}

            <section aria-labelledby="calendar" className="flex flex-col gap-2">
              <h2
                id="calendar"
                className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                {text.calendarTitle}
              </h2>
              <ol
                aria-labelledby="calendar"
                className="flex flex-col gap-1 rounded-card bg-muted p-4 text-sm"
              >
                {calendar
                  ? calendar.map((r) => (
                      <li
                        key={r.round}
                        aria-current={r.state === "current" ? "step" : undefined}
                        className={`flex flex-wrap items-baseline gap-x-1.5 ${r.state === "past" ? "text-muted-foreground" : ""}`}
                      >
                        <span className="font-semibold">
                          {text.calendarRound(r.round, r.hours)}
                        </span>
                        <span className="text-muted-foreground">
                          {text.calendarEnds(text.when(r.endsAt))}
                        </span>
                        {r.state !== "upcoming" && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.state === "current" ? "bg-success/15 text-success-text" : "bg-background text-muted-foreground"}`}
                          >
                            {r.state === "current" ? text.calendarCurrent : text.calendarPast}
                          </span>
                        )}
                      </li>
                    ))
                  : Array.from({ length: PLANNED_ROUNDS }, (_, i) => i + 1).map((n) => (
                      <li key={n} className="font-semibold">
                        {text.calendarRound(n, roundHours(rules.rounds, n))}
                      </li>
                    ))}
              </ol>
            </section>

            {isOwner && !open && !league.isPublic && (
              <section aria-labelledby="invite" className="flex flex-col gap-2">
                <h2
                  id="invite"
                  className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {text.inviteTitle}
                </h2>
                <ShareInvite
                  code={league.inviteCode}
                  leagueName={league.name}
                  path={`/manager/rejoindre?code=${league.inviteCode}`}
                  shareText={text.shareText(league.name)}
                />
              </section>
            )}

            <nav aria-label={text.screens}>
              <ul className="flex flex-col gap-2">
                {leagueScreens(league.id, {
                  open,
                  over: mercato.closedAt !== null,
                  lastPoints: season === "error" ? null : season.lastPoints,
                }).map((screen, i) => (
                  <li key={screen.href}>
                    <Link
                      href={screen.href}
                      className={`${buttonVariants(i === 0 ? {} : { variant: "muted" })} w-full`}
                    >
                      {screen.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <section aria-labelledby="participants" className="flex flex-col gap-2">
              <h2
                id="participants"
                className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                {text.participants}
              </h2>
              <ol aria-labelledby="participants" className="flex flex-col gap-1.5">
                {league.participants.map((p) => (
                  <li
                    key={p.userId}
                    className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-card px-3.5"
                  >
                    <Bib bib={p.bib} />
                    <span className="min-w-0 flex-1 break-words font-semibold">{p.pseudo}</span>
                    {p.userId === league.ownerId && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                        {text.adminBadge}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="rules" className="flex flex-col gap-2">
              <h2
                id="rules"
                className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                {text.rules}
              </h2>
              <LeagueRulesSheet
                rules={{
                  budget: rules.budget,
                  minTeamSize: rules.minTeamSize,
                  lineup: rules.lineup,
                  tablesDivisor: rules.tablesDivisor,
                  bonuses: rules.bonuses,
                }}
                season={
                  format
                    ? text.seasonFormat(
                        league.competitions.length,
                        format.players,
                        format.duelDays,
                        format.bonusDays,
                      )
                    : text.competitions(league.competitions.length)
                }
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

/**
 * The screens of the league, each one a link (#926): the mercato catalogue first, the matchday
 * and the standings once the mercato opened, the last points once there are some, the mercato
 * read again round by round once it is over (#1089).
 */
function leagueScreens(
  leagueId: string,
  { open, over, lastPoints }: { open: boolean; over: boolean; lastPoints: string | null },
): { href: string; label: string }[] {
  const base = `/manager/${leagueId}`;
  return [
    { href: `${base}/catalogue`, label: text.catalogueLink },
    { href: `${base}/equipe`, label: messages.team.link },
    { href: `${base}/alignement`, label: messages.lineup.link },
    ...(open
      ? [
          { href: `${base}/journee`, label: messages.managerChampionship.matchdayLink },
          { href: `${base}/classement`, label: messages.managerChampionship.standingsLink },
        ]
      : []),
    ...(lastPoints
      ? [{ href: `${base}/points/${lastPoints}`, label: messages.managerHome.lastPoints }]
      : []),
    ...(over ? [{ href: `${base}/mercato`, label: messages.mercatoReview.title }] : []),
  ];
}

/** The feed of the league (#875); its own error does not hide the league. */
async function leagueFeed(leagueId: string): Promise<FeedGroup[] | "error"> {
  try {
    const feed = createSupabaseManagerFeedRepository(await getSessionClient());
    return await getManagerFeed({ feed }).execute({ leagueId });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    return "error";
  }
}

/** The season of the league (#774); its own error does not hide the league. */
async function leagueSeason(
  ports: Awaited<ReturnType<typeof managerPorts>>,
  leagueId: string,
  now: Date,
): Promise<MySeason | "error"> {
  try {
    const client = await getSessionClient();
    return await getManagerSeason({
      ...ports,
      season: createSupabaseManagerSeasonRepository(client),
      lineups: createSupabaseManagerLineups(client),
    }).execute({ leagueId, now: now.toISOString() });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    // Outside the league, the league itself answers « not found ».
    return "error";
  }
}
