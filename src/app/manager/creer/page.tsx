import { LeagueHero } from "@/components/leagues/league-hero";

import { messages } from "../../messages.fr";
import { CreateManagerLeagueForm } from "../create-form";
import { managerPorts } from "../data";

/** Creating a French Track Manager league (#419): a name and its visibility, nothing else. */
export default async function CreateManagerLeaguePage() {
  await managerPorts("/manager/creer");
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
        <CreateManagerLeagueForm />
      </div>
    </main>
  );
}
