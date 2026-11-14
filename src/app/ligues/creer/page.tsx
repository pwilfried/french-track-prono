import { CreateLeagueForm } from "@/components/leagues/league-forms";
import { LeagueHero } from "@/components/leagues/league-hero";
import { isOpenToLeagues } from "@/domain/league";
import { pickableFromDays } from "@/domain/season-picker";

import { loadCompetitions } from "../../competition";
import { paramList } from "../../search-params";
import { messages } from "../../messages.fr";
import { leaguePorts } from "../data";

/**
 * League creation: its name, its families and its competitions, ticked in the season picker of the
 * Manager (#721), the ones given in the address (`competition`) ticked from the start. Only the
 * competitions not finished are offered (#614).
 */
export default async function CreateLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string | string[]; publique?: string }>;
}) {
  const params = await searchParams;
  const asked = [...new Set(paramList(params.competition))];
  await leaguePorts(
    asked.length
      ? `/ligues/creer?${new URLSearchParams(asked.map((slug) => ["competition", slug]))}`
      : "/ligues/creer",
  );
  const { coming } = await loadCompetitions();
  const now = new Date().toISOString();
  const competitions = coming.filter((c) => isOpenToLeagues(c, now)).map(pickableFromDays);
  const chosen = competitions.filter((c) => asked.includes(c.id)).map((c) => c.id);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={messages.leagues.createTitle}
        subtitle={messages.leagues.createSubtitle}
        back={{ href: "/ligues", label: messages.leagues.back }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <CreateLeagueForm
          competitions={competitions}
          chosen={chosen}
          isPublic={params.publique === "1"}
        />
      </div>
    </main>
  );
}
