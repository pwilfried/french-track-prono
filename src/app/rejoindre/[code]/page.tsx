import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinByLinkForm } from "@/components/leagues/league-forms";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";
import { formatInviteCode, normalizeInviteCode } from "@/domain/league";

import { messages } from "../../messages.fr";
import { getCurrentUser } from "../../session";

/**
 * Invite link `/rejoindre/K7M2QX`: a visitor signs in first and comes back here; a player joins with
 * one tap. The league's name stays hidden until then (only members can read a league).
 */
export default async function InviteLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeInviteCode(decodeURIComponent(raw));
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(`/rejoindre/${raw}`)}`);

  return (
    <main className="flex flex-1 flex-col">
      <LeagueHero title={messages.leagues.inviteTitle} subtitle={messages.leagues.inviteSubtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        {code ? (
          <>
            <p className="rounded-card bg-muted p-4">
              {messages.leagues.invited(formatInviteCode(code))}
            </p>
            <JoinByLinkForm code={code} />
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
              {messages.leagues.inviteNote}
            </p>
          </>
        ) : (
          <>
            <p role="alert" className="rounded-card bg-muted p-4 font-semibold text-accent-text">
              {messages.errors.LEAGUE_CODE_UNKNOWN}
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
