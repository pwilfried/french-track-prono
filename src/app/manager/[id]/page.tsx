import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getManagerLeague, type ManagerLeagueFile } from "@/application/manager-leagues";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { ShareInvite } from "@/components/leagues/share-invite";
import {
  canStartManagerSeason,
  MANAGER_LEAGUE_MAX,
  MANAGER_LEAGUE_MIN,
} from "@/domain/manager-league";

import { messages } from "../../messages.fr";
import { managerPorts } from "../data";

const text = messages.manager;

/** A Manager league (#419): its participants, whether the season can start, its frozen rules. */
export default async function ManagerLeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ports = await managerPorts(`/manager/${id}`);
  let league: ManagerLeagueFile | "error";
  try {
    league = await getManagerLeague(ports).execute({ id });
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
  const ready = canStartManagerSeason(count);
  const isOwner = league.ownerId === ports.userId;
  const { rules } = league;

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={league.name}
        subtitle={`${text.participantsCount(count, MANAGER_LEAGUE_MAX)} · ${league.isPublic ? text.publicBadge : text.privateBadge}`}
        back={{ href: "/manager", label: text.back }}
        icon="🏟️"
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <p
          role="status"
          className={`rounded-2xl px-3.5 py-3 text-sm font-semibold ${ready ? "bg-success/15 text-success-text" : "bg-muted text-foreground"}`}
        >
          {ready ? text.ready : text.notReady(MANAGER_LEAGUE_MIN, MANAGER_LEAGUE_MAX)}
        </p>

        {isOwner && !league.isPublic && (
          <ShareInvite
            code={league.inviteCode}
            leagueName={league.name}
            path={`/manager/rejoindre?code=${league.inviteCode}`}
            shareText={text.shareText(league.name)}
          />
        )}

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
                <span aria-hidden className="text-xl">
                  {p.avatar}
                </span>
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
          <ul className="flex flex-col gap-1 rounded-card bg-muted p-4 text-sm">
            <li>{text.budget(rules.budget)}</li>
            <li>{text.teamSize(rules.teamSize)}</li>
            <li>{text.lineup(rules.lineup.max)}</li>
            <li>{text.competitions(league.competitionCount)}</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
