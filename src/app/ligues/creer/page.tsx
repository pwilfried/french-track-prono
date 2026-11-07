import { CreateLeagueForm } from "@/components/leagues/league-forms";
import { LeagueHero } from "@/components/leagues/league-hero";

import { messages } from "../../messages.fr";
import { leaguePorts } from "../data";

export default async function CreateLeaguePage() {
  await leaguePorts("/ligues/creer");
  return (
    <main className="flex flex-1 flex-col">
      <LeagueHero
        title={messages.leagues.createTitle}
        subtitle={messages.leagues.createSubtitle}
        back={{ href: "/ligues", label: messages.leagues.back }}
      />
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <CreateLeagueForm />
      </div>
    </main>
  );
}
