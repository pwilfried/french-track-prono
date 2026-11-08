import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getLeague } from "@/application/leagues";
import { getLeagueRanking } from "@/application/rankings";
import { ErrorNotice } from "@/components/error-notice";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { LeaveLeagueForm } from "@/components/leagues/league-forms";
import { LeagueHero } from "@/components/leagues/league-hero";
import { ShareInvite } from "@/components/leagues/share-invite";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { messages } from "../../messages.fr";
import { leaguePorts } from "../data";

const TABS = ["classement", "membres", "inviter"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  classement: messages.leagues.tabs.ranking,
  membres: messages.leagues.tabs.members,
  inviter: messages.leagues.tabs.invite,
};

async function load(id: string, ports: Awaited<ReturnType<typeof leaguePorts>>) {
  try {
    const found = await getLeague(ports).execute({ leagueId: id });
    const ranking = await getLeagueRanking(ports).execute({
      leagueId: id,
      competitionSlugs: found.league.competitionSlugs,
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
  searchParams: Promise<{ onglet?: string; nouvelle?: string }>;
}) {
  const { id } = await params;
  // A league id is a UUID: anything else cannot be a league.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const query = await searchParams;
  const tab = TABS.find((t) => t === query.onglet) ?? "classement";
  const ports = await leaguePorts(`/ligues/${id}`);
  const loaded = await load(id, ports);

  if (loaded === "error") {
    return (
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <ErrorNotice retryHref={`/ligues/${id}`} message={messages.errors.LEAGUES_UNAVAILABLE} />
      </main>
    );
  }

  const { league, members, ranking } = loaded;
  const isOwner = league.ownerId === ports.userId;
  const subtitle = [
    messages.leagues.members(league.memberCount),
    messages.leagues.codeShort(league.inviteCode),
    isOwner ? messages.leagues.createdByMe : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={league.name}
        subtitle={subtitle}
        back={{ href: "/ligues", label: messages.leagues.back }}
        icon="🏆"
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label={league.name}>
          {TABS.map((t) => (
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
              {t === "membres" ? `${TAB_LABEL[t]} (${league.memberCount})` : TAB_LABEL[t]}
            </Link>
          ))}
        </nav>

        {tab === "classement" && (
          <>
            <Leaderboard rows={ranking} meId={ports.userId} retryHref={`/ligues/${id}`} />
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
              {messages.leagues.tieRule}
            </p>
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
                  <span
                    aria-hidden
                    className="grid size-9 place-items-center rounded-full bg-muted text-lg"
                  >
                    {m.avatar}
                  </span>
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
