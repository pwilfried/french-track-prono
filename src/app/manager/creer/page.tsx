import { UseCaseError } from "@/application/errors";
import { listNewLeagueJokers } from "@/application/league-jokers";
import { listSeasonCompetitions, type SeasonCompetition } from "@/application/manager-leagues";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { ManagerJokerList } from "@/components/manager/manager-jokers";
import { isManagerJoker, type ManagerJoker } from "@/domain/manager-jokers";
import { createSupabaseLeagueJokerRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { CreateManagerLeagueForm } from "../create-form";
import { getSessionClient } from "../../session";
import { managerPorts } from "../data";

/** The jokers the new Manager league will receive (#1091); null when they cannot be read. */
async function loadNewLeagueJokers(): Promise<ManagerJoker[] | null> {
  try {
    const jokers = createSupabaseLeagueJokerRepository(await getSessionClient());
    return (await listNewLeagueJokers({ jokers }).execute({ game: "manager" })).filter(
      isManagerJoker,
    );
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

/**
 * Creating a French Track Manager league (#419): a name, its visibility and its competitions, the
 * number of players following from them (#644).
 */
export default async function CreateManagerLeaguePage() {
  const ports = await managerPorts("/manager/creer");
  let competitions: SeasonCompetition[] | "error";
  const jokers = loadNewLeagueJokers();
  try {
    competitions = await listSeasonCompetitions(ports).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    competitions = "error";
  }
  const newJokers = await jokers;
  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={messages.manager.createTitle}
        subtitle={messages.manager.createSubtitle}
        back={{ href: "/manager", label: messages.manager.back }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <p className="rounded-card bg-brand-soft p-4 text-sm leading-relaxed text-brand-ink">
          {messages.manager.rulesNote}
        </p>
        {competitions === "error" ? (
          <ErrorNotice retryHref="/manager/creer" message={messages.errors.LEAGUES_UNAVAILABLE} />
        ) : (
          <CreateManagerLeagueForm competitions={competitions} />
        )}
        {newJokers && (
          <section aria-labelledby="league-jokers" className="flex flex-col gap-2">
            <h2 id="league-jokers" className="font-display text-xl font-extrabold">
              {messages.leagueJokers.createTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{messages.managerJokers.createText}</p>
            <ManagerJokerList jokers={newJokers} />
          </section>
        )}
      </div>
    </main>
  );
}
