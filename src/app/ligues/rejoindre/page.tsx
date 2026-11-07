import { JoinLeagueForm } from "@/components/leagues/league-forms";
import { LeagueHero } from "@/components/leagues/league-hero";

import { messages } from "../../messages.fr";
import { leaguePorts } from "../data";

export default async function JoinLeaguePage() {
  await leaguePorts("/ligues/rejoindre");
  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={messages.leagues.joinTitle}
        subtitle={messages.leagues.joinSubtitle}
        back={{ href: "/ligues", label: messages.leagues.back }}
      />
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <JoinLeagueForm />
      </div>
    </main>
  );
}
