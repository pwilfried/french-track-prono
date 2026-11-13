import { UseCaseError } from "@/application/errors";
import { listSeasonCompetitions, type SeasonCompetition } from "@/application/manager-leagues";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";

import { messages } from "../../messages.fr";
import { CreateManagerLeagueForm } from "../create-form";
import { managerPorts } from "../data";

/**
 * Creating a French Track Manager league (#419): a name, its visibility and its competitions, the
 * number of players following from them (#644).
 */
export default async function CreateManagerLeaguePage() {
  const ports = await managerPorts("/manager/creer");
  let competitions: SeasonCompetition[] | "error";
  try {
    competitions = await listSeasonCompetitions(ports).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    competitions = "error";
  }
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
      </div>
    </main>
  );
}
