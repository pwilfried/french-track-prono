import { LeagueHero } from "@/components/leagues/league-hero";

import { messages } from "../../messages.fr";
import { managerPorts } from "../data";
import { JoinManagerLeagueForm } from "../join-forms";

/** Joining a Manager league with its code; the invite link fills it in (`?code=K7M2QX`, #420). */
export default async function JoinManagerLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const initialCode = typeof code === "string" ? code : "";
  await managerPorts(
    initialCode
      ? `/manager/rejoindre?code=${encodeURIComponent(initialCode)}`
      : "/manager/rejoindre",
  );
  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={messages.manager.joinTitle}
        subtitle={messages.manager.joinSubtitle}
        back={{ href: "/manager", label: messages.manager.back }}
      />
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <JoinManagerLeagueForm initialCode={initialCode} />
      </div>
    </main>
  );
}
