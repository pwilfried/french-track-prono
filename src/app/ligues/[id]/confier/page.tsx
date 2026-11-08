import { notFound, redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getLeague } from "@/application/leagues";
import { HandOverForm } from "@/components/leagues/league-forms";
import { LeagueHero } from "@/components/leagues/league-hero";

import { messages } from "../../../messages.fr";
import { leaguePorts } from "../../data";

export default async function HandOverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ports = await leaguePorts(`/ligues/${id}/confier`);
  let found;
  try {
    found = await getLeague(ports).execute({ leagueId: id });
  } catch (error) {
    if (error instanceof UseCaseError) notFound();
    throw error;
  }
  // Only the owner hands the league over.
  if (found.league.ownerId !== ports.userId) redirect(`/ligues/${id}`);
  const others = found.members.filter((m) => m.userId !== ports.userId);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={messages.leagues.handOverTitle}
        subtitle={messages.leagues.handOverSubtitle}
        back={{ href: `/ligues/${id}?onglet=membres`, label: found.league.name }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        {others.length === 0 ? (
          <p className="rounded-card bg-muted p-4">{messages.leagues.handOverNobody}</p>
        ) : (
          <>
            <HandOverForm leagueId={id} members={others} />
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
              {messages.leagues.handOverNote}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
