import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getLeague } from "@/application/leagues";
import { getLeagueRanking } from "@/application/rankings";
import { ErrorNotice } from "@/components/error-notice";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import {
  AddLeagueCompetitionForm,
  LeaveLeagueForm,
  ReportLeagueForm,
} from "@/components/leagues/league-forms";
import { LeagueCompetitions } from "@/components/leagues/league-competitions";
import { InviteBanner } from "@/components/leagues/invite-banner";
import { LeagueHero } from "@/components/leagues/league-hero";
import { ShareInvite } from "@/components/leagues/share-invite";
import { Bib } from "@/components/profile/bib";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { currentCompetitionDay, currentDay, loadCompetitions } from "../../competition";
import { messages } from "../../messages.fr";
import { leaguePorts } from "../data";

const TABS = ["classement", "membres", "inviter"] as const;
type Tab = (typeof TABS)[number];
/** The tabs in the bar; « inviter » opens from the « Inviter » button of the header (#552). */
const BAR: { tab: Tab; label: string }[] = [
  { tab: "classement", label: messages.leagues.tabs.ranking },
  { tab: "membres", label: messages.leagues.tabs.members },
];

async function load(id: string, ports: Awaited<ReturnType<typeof leaguePorts>>) {
  try {
    const found = await getLeague(ports).execute({ leagueId: id });
    const ranking = await getLeagueRanking(ports).execute({
      leagueId: id,
      competitionSlugs: found.league.competitionSlugs,
      today: currentCompetitionDay(),
    });
    return { ...found, ranking };
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "LEAGUE_NOT_FOUND") notFound();
      return "error" as const;
    }
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
  const [loaded, competitions] = await Promise.all([load(id, ports), loadCompetitions()]);

  if (loaded === "error") {
    return (
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <ErrorNotice retryHref={`/ligues/${id}`} message={messages.errors.LEAGUES_UNAVAILABLE} />
      </main>
    );
  }

  const { league, members, ranking } = loaded;
  const isOwner = league.ownerId === ports.userId;
  const known = [...competitions.coming, ...competitions.past];
  const counted = known.filter((c) => league.competitionSlugs.includes(c.slug));
  // Only competitions still to come can be added (the database checks it too).
  const addable = competitions.coming.filter(
    (c) => !league.competitionSlugs.includes(c.slug) && c.startsOn > currentDay(),
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
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label={league.name}>
          {BAR.map(({ tab: t, label }) => (
            <Link
              key={t}
              href={`/ligues/${id}?onglet=${t}`}
              aria-current={t === tab ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 font-semibold",
                t === tab
                  ? "bg-brand text-brand-foreground dark:bg-secondary dark:text-secondary-foreground"
                  : "border border-border bg-background text-foreground",
              )}
            >
              {t === "membres" ? `${label} (${league.memberCount})` : label}
            </Link>
          ))}
        </nav>

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
            {alone && <InviteBanner code={league.inviteCode} leagueName={league.name} />}
            <LeagueCompetitions
              competitions={counted}
              addableCount={addable.length}
              isOwner={isOwner}
            >
              <AddLeagueCompetitionForm leagueId={id} choices={addable} />
            </LeagueCompetitions>
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
          </>
        )}

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
            <ShareInvite code={league.inviteCode} leagueName={league.name} />
          </>
        )}
      </div>
    </main>
  );
}
