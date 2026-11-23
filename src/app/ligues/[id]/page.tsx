import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getMyLeagueJokers } from "@/application/league-jokers";
import { getLeagueFeed } from "@/application/league-moments";
import { getLeague } from "@/application/leagues";
import { getMomentReactions } from "@/application/moment-reactions";
import { getLeagueRanking } from "@/application/rankings";
import { ErrorNotice } from "@/components/error-notice";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import {
  AddLeagueCompetitionForm,
  LeaveLeagueForm,
  ReportLeagueForm,
} from "@/components/leagues/league-forms";
import { FamilyBadge } from "@/components/leagues/family-badge";
import { LeagueCompetitions } from "@/components/leagues/league-competitions";
import { LeagueEventList } from "@/components/leagues/league-event-list";
import { LeagueFeed } from "@/components/leagues/league-feed";
import { InviteBanner } from "@/components/leagues/invite-banner";
import { LeagueHero } from "@/components/leagues/league-hero";
import { MyJokers, type PlayedJoker } from "@/components/leagues/league-jokers";
import { LeaguePredict } from "@/components/leagues/league-predict";
import { LeagueTabs } from "@/components/leagues/league-tabs";
import { ShareInvite } from "@/components/leagues/share-invite";
import { Bib } from "@/components/profile/bib";
import { buttonVariants } from "@/components/ui/button";
import { isOpenToLeagues } from "@/domain/league";
import { addableFamilies } from "@/domain/league-families";

import { currentCompetitionDay, loadCompetitions } from "../../competition";
import { messages } from "../../messages.fr";
import { publicEventReader } from "../../public-data";
import { leaguePorts, loadLeagueEvents, loadLeaguePredict } from "../data";
import {
  reactToMomentAction,
  reportMomentReactionAction,
  sendMomentMessageAction,
} from "./reaction-actions";

const TABS = ["classement", "fil", "membres", "inviter"] as const;
type Tab = (typeof TABS)[number];
/** The tabs in the bar; « inviter » opens from the « Inviter » button of the header (#552). */
const BAR: { tab: Tab; label: string }[] = [
  { tab: "classement", label: messages.leagues.tabs.ranking },
  { tab: "fil", label: messages.leagues.tabs.feed },
  { tab: "membres", label: messages.leagues.tabs.members },
];

async function load(id: string, ports: Awaited<ReturnType<typeof leaguePorts>>) {
  try {
    const found = await getLeague(ports).execute({ leagueId: id });
    const ranking = await getLeagueRanking(ports).execute({
      leagueId: id,
      competitionSlugs: found.league.competitionSlugs,
      families: found.league.families,
      competitionAddedAt: found.league.competitionAddedAt,
      today: currentCompetitionDay(),
    });
    // A league limited to families lists its events, the others greyed « Hors ligue » (#613).
    const families = found.league.families ?? [];
    const events =
      families.length > 0
        ? await loadLeagueEvents({ competitionSlugs: found.league.competitionSlugs, families })
        : [];
    return { ...found, ranking, events };
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "LEAGUE_NOT_FOUND") notFound();
      return "error" as const;
    }
    throw error;
  }
}

/**
 * My jokers in the league (#1090): the ones left and the ones played, each with its event; null
 * when they cannot be read, or when the league has none.
 */
async function loadMyJokers(
  leagueId: string,
  competitionSlugs: string[],
  ports: Awaited<ReturnType<typeof leaguePorts>>,
) {
  try {
    const hand = await getMyLeagueJokers(ports).execute({ leagueId, userId: ports.userId });
    if (hand.remaining.length === 0 && hand.used.length === 0) return null;
    const events =
      hand.used.length > 0
        ? (
            await Promise.all(
              competitionSlugs.map((slug) => publicEventReader().listByCompetition(slug)),
            )
          ).flat()
        : [];
    const used = hand.used.map((play): PlayedJoker => {
      const event = events.find((e) => e.id === play.eventId);
      return {
        joker: play.joker,
        event: event
          ? {
              name: messages.events.name(event.discipline, event.gender),
              href: `/epreuves/${event.slug}`,
            }
          : null,
      };
    });
    return { remaining: hand.remaining, used };
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string; nouvelle?: string; ajoutee?: string }>;
}) {
  const { id } = await params;
  // A league id is a UUID: anything else cannot be a league.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const query = await searchParams;
  const tab = TABS.find((t) => t === query.onglet) ?? "classement";
  const ports = await leaguePorts(`/ligues/${id}`);
  const [loaded, competitions, feed] = await Promise.all([
    load(id, ports),
    loadCompetitions(),
    // The feed and its reactions are read only on its tab (#671, #672).
    tab === "fil"
      ? Promise.all([
          getLeagueFeed(ports).execute({ leagueId: id }),
          getMomentReactions(ports).execute({ leagueId: id }),
        ]).catch(() => "error" as const)
      : null,
  ]);

  if (loaded === "error") {
    return (
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <ErrorNotice retryHref={`/ligues/${id}`} message={messages.errors.LEAGUES_UNAVAILABLE} />
      </main>
    );
  }

  const { league, members, ranking, events } = loaded;
  const jokers =
    tab === "classement" ? await loadMyJokers(id, league.competitionSlugs, ports) : null;
  const isOwner = league.ownerId === ports.userId;
  const families = league.families ?? [];
  const canAddFamily = isOwner && addableFamilies(families).length > 0;
  const known = [...competitions.coming, ...competitions.past];
  const counted = known.filter((c) => league.competitionSlugs.includes(c.slug));
  // Only competitions not finished can be added (#614; the database checks it too).
  const now = new Date().toISOString();
  const addable = competitions.coming.filter(
    (c) => !league.competitionSlugs.includes(c.slug) && isOpenToLeagues(c, now),
  );
  const owner = members.find((m) => m.userId === league.ownerId);
  const subtitle = [
    messages.leagues.players(league.memberCount),
    isOwner
      ? messages.leagues.createdByMe
      : owner
        ? messages.leagues.createdBy(owner.pseudo)
        : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const alone = league.memberCount <= 1;
  // Not on « Inviter »: it is about the friends, not my predictions (#1069).
  const predict =
    tab === "inviter"
      ? null
      : await loadLeaguePredict({
          userId: ports.userId,
          competitionSlugs: league.competitionSlugs,
          families,
          competitions: competitions.coming,
        });

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={league.name}
        subtitle={subtitle}
        back={{ href: "/ligues", label: messages.leagues.back }}
        icon="🏆"
        action={
          <Link
            href={`/ligues/${id}?onglet=inviter`}
            aria-current={tab === "inviter" ? "page" : undefined}
            className={`${buttonVariants({ variant: "outline" })} px-4 text-sm`}
          >
            {messages.leagues.invite}
          </Link>
        }
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        {tab !== "inviter" && <LeaguePredict call={predict} now={new Date()} leagueId={id} />}
        <LeagueTabs
          label={league.name}
          tabs={BAR.map(({ tab: t, label }) => ({
            href: `/ligues/${id}?onglet=${t}`,
            label: t === "membres" ? `${label} (${league.memberCount})` : label,
            active: t === tab,
          }))}
        />

        {tab === "classement" && (
          <>
            {query.ajoutee === "1" && (
              <p
                role="status"
                className="rounded-2xl bg-success/15 px-3.5 py-3 text-sm font-semibold text-success-text"
              >
                {messages.leagues.added}
              </p>
            )}
            {families.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <FamilyBadge families={families.map((f) => f.family)} className="text-sm" />
                {canAddFamily && (
                  <Link
                    href={`/ligues/${id}/familles`}
                    className="inline-flex min-h-11 items-center px-1 text-sm font-bold"
                  >
                    {messages.leagues.addFamily}
                  </Link>
                )}
              </div>
            )}
            {families
              .filter((f) => f.addedAt !== null)
              .map((f) => (
                <p
                  key={f.family}
                  role="status"
                  className="rounded-2xl bg-brand-soft px-3.5 py-3 text-sm font-semibold text-brand-ink"
                >
                  {messages.leagues.familyAdded(messages.leagues.family[f.family], f.addedAt!)}
                </p>
              ))}
            {alone && (
              <InviteBanner
                code={league.inviteCode}
                leagueName={league.name}
                isPublic={league.isPublic}
              />
            )}
            <LeagueCompetitions
              competitions={counted}
              addableCount={addable.length}
              isOwner={isOwner}
            >
              <AddLeagueCompetitionForm leagueId={id} choices={addable} />
            </LeagueCompetitions>
            {families.length > 0 && (
              <LeagueEventList events={events} title={messages.leagues.eventsTitle} leagueId={id} />
            )}
            {!alone && (
              <>
                <Leaderboard rows={ranking} meId={ports.userId} retryHref={`/ligues/${id}`} />
                <details className="group self-end text-right">
                  <summary className="ml-auto grid size-11 cursor-pointer list-none place-items-center rounded-full border border-border font-extrabold [&::-webkit-details-marker]:hidden">
                    <span aria-hidden>?</span>
                    <span className="sr-only">{messages.leagues.tieHelp}</span>
                  </summary>
                  <p className="mt-2 rounded-card bg-muted p-4 text-left text-sm text-muted-foreground">
                    {messages.leagues.tieRule}
                  </p>
                </details>
              </>
            )}
            {jokers && <MyJokers remaining={jokers.remaining} used={jokers.used} />}
          </>
        )}

        {tab === "fil" &&
          (feed === "error" ? (
            <ErrorNotice
              retryHref={`/ligues/${id}?onglet=fil`}
              message={messages.errors.LEAGUES_UNAVAILABLE}
            />
          ) : (
            <LeagueFeed
              groups={feed?.[0] ?? []}
              reactions={
                feed
                  ? {
                      leagueId: id,
                      byMoment: feed[1],
                      actions: {
                        react: reactToMomentAction,
                        send: sendMomentMessageAction,
                        report: reportMomentReactionAction,
                      },
                    }
                  : undefined
              }
            />
          ))}

        {tab === "membres" && (
          <>
            <ul className="flex flex-col">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="flex min-h-13 items-center gap-3 border-b border-border py-2"
                >
                  <Bib bib={m.bib} />
                  <span className="min-w-0 flex-1 break-words font-bold">{m.pseudo}</span>
                  {m.userId === league.ownerId && (
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-extrabold text-secondary-foreground">
                      {messages.leagues.owner}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <h2 className="pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {messages.leagues.actions}
            </h2>
            {isOwner && league.memberCount > 1 && (
              <Link
                href={`/ligues/${id}/confier`}
                className={`${buttonVariants({ variant: "outline" })} w-full`}
              >
                {messages.leagues.handOver}
              </Link>
            )}
            <LeaveLeagueForm leagueId={id} />
            {league.isPublic && !isOwner && <ReportLeagueForm leagueId={id} name={league.name} />}
          </>
        )}

        {tab === "inviter" && (
          <>
            {query.nouvelle === "1" && (
              <p
                role="status"
                className="rounded-2xl bg-success/15 px-3.5 py-3 text-sm font-semibold text-success-text"
              >
                {messages.leagues.created}
              </p>
            )}
            <ShareInvite
              code={league.inviteCode}
              leagueName={league.name}
              isPublic={league.isPublic}
            />
          </>
        )}
      </div>
    </main>
  );
}
