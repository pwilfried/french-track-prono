import Link from "next/link";

import { leagueInvite } from "@/application/leagues";
import { JoinByLinkForm } from "@/components/leagues/league-forms";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";
import { formatInviteCode, normalizeInviteCode } from "@/domain/league";

import { leaguePorts } from "../../ligues/data";
import { messages } from "../../messages.fr";

/**
 * Invite link `/rejoindre/K7M2QX`: a visitor signs in first and comes back here; a player joins with
 * one tap. The league's name stays hidden until then (only members can read a league). A league
 * that has started is closed to newcomers (#780): the page says so instead of the button.
 */
export default async function InviteLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeInviteCode(decodeURIComponent(raw));
  const { leagues } = await leaguePorts(`/rejoindre/${raw}`);
  const status = code ? await leagueInvite({ leagues }).execute({ code }) : "unknown";

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero title={messages.leagues.inviteTitle} subtitle={messages.leagues.inviteSubtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        {code && (status === "open" || status === "member") ? (
          <>
            <p className="rounded-card bg-muted p-4">
              {messages.leagues.invited(formatInviteCode(code))}
            </p>
            <JoinByLinkForm code={code} />
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
              {messages.leagues.inviteNote}
            </p>
          </>
        ) : status === "started" ? (
          <>
            <p role="alert" className="rounded-card bg-muted p-4 font-semibold text-accent-text">
              {messages.errors.LEAGUE_STARTED}
            </p>
            <Link href="/ligues?onglet=decouvrir" className={`${buttonVariants()} w-full`}>
              {messages.leagues.startedJoinPublic}
            </Link>
            <Link href="/ligues/creer" className={`${buttonVariants({ variant: "muted" })} w-full`}>
              {messages.leagues.create}
            </Link>
          </>
        ) : (
          <>
            <p role="alert" className="rounded-card bg-muted p-4 font-semibold text-accent-text">
              {status === "too_many"
                ? messages.errors.LEAGUE_TOO_MANY_ATTEMPTS
                : messages.errors.LEAGUE_CODE_UNKNOWN}
            </p>
            <Link
              href="/ligues/rejoindre"
              className={`${buttonVariants({ variant: "muted" })} w-full`}
            >
              {messages.leagues.join}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
